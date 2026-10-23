// Fachada pública de auth da API: web e Android só falam com `/auth/*`, nunca
// com o Neon Auth. Erros seguem `{ error: string }`; qualquer falha do provedor
// (5xx ou timeout de 10 s) vira 502 `auth unavailable`.
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  EmailInput,
  RefreshInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
  VerifyEmailInput,
  type AuthSessionDto,
  type MeDto,
} from "@indice/shared";
import { config } from "../config.js";
import { parse } from "../lib/http.js";
import { NeonAuthError } from "../lib/neon-auth-client.js";
import { isAllowed } from "../modules/auth/allowlist.js";
import type { AuthContext } from "../modules/auth/context.js";
import { expiresAtIso } from "../modules/auth/jwt.js";
import { resolveOrLinkUser } from "../modules/auth/resolve-user.js";

// Limite próprio de `/auth/*`: 10 por minuto por IP, fixo no código.
const authLimit = {
  config: {
    rateLimit: {
      max: config.authRateLimitMax,
      timeWindow: "1 minute",
      keyGenerator: (req: FastifyRequest) => req.ip,
    },
  },
};

function notConfigured(reply: FastifyReply) {
  return reply.code(503).send({ error: "auth not configured" });
}

function unavailable(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  app.log.error({ err: error }, "neon auth failure");
  return reply.code(502).send({ error: "auth unavailable" });
}

function neonError(error: unknown): NeonAuthError | null {
  return error instanceof NeonAuthError ? error : null;
}

function isClientError(error: NeonAuthError | null): boolean {
  return error !== null && error.status >= 400 && error.status < 500;
}

function signUpFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  const provider = neonError(error);
  if (provider) {
    if (provider.status === 409 || provider.code.toUpperCase().includes("EXIST")) {
      return reply.code(409).send({ error: "email already registered" });
    }
    if (isClientError(provider)) return reply.code(400).send({ error: "validation" });
  }
  return unavailable(app, reply, error);
}

function signInFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  const provider = neonError(error);
  if (provider) {
    const code = provider.code.toUpperCase();
    // O provedor devolve o motivo no `code`; o status sozinho não separa
    // "e-mail não verificado" de outras recusas 403.
    if (code === "EMAIL_NOT_VERIFIED") {
      return reply.code(403).send({ error: "email not verified" });
    }
    if (provider.status === 401 || code === "INVALID_EMAIL_OR_PASSWORD") {
      return reply.code(401).send({ error: "invalid credentials" });
    }
    if (provider.status === 400 || provider.status === 422) {
      return reply.code(401).send({ error: "invalid credentials" });
    }
  }
  return unavailable(app, reply, error);
}

function refreshFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  const provider = neonError(error);
  if (isClientError(provider)) return reply.code(401).send({ error: "invalid session" });
  return unavailable(app, reply, error);
}

function invalidCodeFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  const provider = neonError(error);
  if (isClientError(provider)) return reply.code(400).send({ error: "invalid code" });
  return unavailable(app, reply, error);
}

function invalidTokenFailure(app: FastifyInstance, reply: FastifyReply, error: unknown) {
  const provider = neonError(error);
  if (isClientError(provider)) return reply.code(400).send({ error: "invalid token" });
  return unavailable(app, reply, error);
}

export async function authRoutes(app: FastifyInstance, opts: { auth: AuthContext }) {
  const auth = opts.auth;

  // Cadastro com e-mail fora da allowlist é recusado antes de falar com o Neon.
  app.post("/auth/sign-up", authLimit, async (req, reply) => {
    const body = parse(SignUpInput, req.body, reply);
    if (!body) return;
    if (!auth.neonAuth) return notConfigured(reply);
    if (!isAllowed(auth.allowlist, body.email)) return reply.code(403).send({ error: "not allowed" });

    try {
      await auth.neonAuth.signUp(body);
    } catch (error) {
      return signUpFailure(app, reply, error);
    }
    return reply.code(201).send({ status: "verification_required" });
  });

  app.post("/auth/verify-email", authLimit, async (req, reply) => {
    const body = parse(VerifyEmailInput, req.body, reply);
    if (!body) return;
    if (!auth.neonAuth) return notConfigured(reply);

    try {
      await auth.neonAuth.verifyEmail(body);
    } catch (error) {
      return invalidCodeFailure(app, reply, error);
    }
    return reply.code(204).send();
  });

  // 204 sempre: não revela se o e-mail existe nem se o cadastro pendente existe.
  app.post("/auth/resend-verification", authLimit, async (req, reply) => {
    const body = parse(EmailInput, req.body, reply);
    if (!body) return;
    if (!auth.neonAuth) return notConfigured(reply);

    try {
      await auth.neonAuth.resendVerification(body.email);
    } catch (error) {
      app.log.warn({ err: error }, "resend-verification failed");
    }
    return reply.code(204).send();
  });

  app.post("/auth/sign-in", authLimit, async (req, reply) => {
    const body = parse(SignInInput, req.body, reply);
    if (!body) return;
    const client = auth.neonAuth;
    if (!client) return notConfigured(reply);

    let sessionToken: string;
    try {
      ({ sessionToken } = await client.signIn(body));
    } catch (error) {
      return signInFailure(app, reply, error);
    }

    if (!auth.verifier) return unavailable(app, reply, new Error("verificador de JWT ausente"));

    let token: string;
    let claims;
    try {
      token = await client.fetchToken(sessionToken);
      claims = await auth.verifier(token);
    } catch (error) {
      return unavailable(app, reply, error);
    }

    if (!claims.emailVerified) return reply.code(403).send({ error: "email not verified" });

    // O sign-in resolve ou liga o `User` antes de responder: `user.id` já é o
    // id do Índice (plan.md, 003).
    const allowed = isAllowed(auth.allowlist, claims.email);
    const result = await resolveOrLinkUser(auth.store, claims, allowed);
    if ("error" in result) return reply.code(403).send({ error: result.error });
    if (!isAllowed(auth.allowlist, result.user.email)) return reply.code(403).send({ error: "not allowed" });

    const session: AuthSessionDto = {
      accessToken: token,
      accessTokenExpiresAt: expiresAtIso(claims.exp),
      refreshToken: sessionToken,
      user: { id: result.user.id, email: result.user.email, displayName: result.user.displayName },
    };
    return reply.code(200).send(session);
  });

  app.post("/auth/refresh", authLimit, async (req, reply) => {
    const body = parse(RefreshInput, req.body, reply);
    if (!body) return;
    const client = auth.neonAuth;
    if (!client) return notConfigured(reply);
    if (!auth.verifier) return unavailable(app, reply, new Error("verificador de JWT ausente"));

    try {
      const token = await client.fetchToken(body.refreshToken);
      const claims = await auth.verifier(token);
      return reply.code(200).send({ accessToken: token, accessTokenExpiresAt: expiresAtIso(claims.exp) });
    } catch (error) {
      return refreshFailure(app, reply, error);
    }
  });

  // Idempotente: sessão já encerrada, provedor fora do ar ou token inválido
  // continuam 204 — o cliente só precisa apagar os cookies/estado local.
  app.post("/auth/sign-out", authLimit, async (req, reply) => {
    const body = parse(RefreshInput, req.body, reply);
    if (!body) return;
    if (!auth.neonAuth) return notConfigured(reply);

    try {
      await auth.neonAuth.signOut(body.refreshToken);
    } catch (error) {
      app.log.warn({ err: error }, "sign-out failed");
    }
    return reply.code(204).send();
  });

  // 204 sempre, para não revelar a existência do e-mail.
  app.post("/auth/forgot-password", authLimit, async (req, reply) => {
    const body = parse(EmailInput, req.body, reply);
    if (!body) return;
    if (!auth.neonAuth) return notConfigured(reply);

    try {
      await auth.neonAuth.forgotPassword({
        email: body.email,
        redirectTo: auth.webOrigin ? `${auth.webOrigin}/redefinir-senha` : undefined,
      });
    } catch (error) {
      app.log.warn({ err: error }, "forgot-password failed");
    }
    return reply.code(204).send();
  });

  app.post("/auth/reset-password", authLimit, async (req, reply) => {
    const body = parse(ResetPasswordInput, req.body, reply);
    if (!body) return;
    if (!auth.neonAuth) return notConfigured(reply);

    try {
      await auth.neonAuth.resetPassword(body);
    } catch (error) {
      return invalidTokenFailure(app, reply, error);
    }
    return reply.code(204).send();
  });

  // Autenticada pelo hook (JWT ou chave de API), não é rota pública.
  app.get("/me", async (req, reply) => {
    const user = await auth.store.findById(req.userId);
    if (!user) return reply.code(401).send({ error: "invalid credential" });

    const me: MeDto = { id: user.id, email: user.email, displayName: user.displayName };
    return reply.code(200).send(me);
  });
}
