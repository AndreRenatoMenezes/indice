import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from "jose";
import { buildApp } from "../app.js";
import { NeonAuthError, type NeonAuthClient } from "../lib/neon-auth-client.js";
import type { AuthContext } from "../modules/auth/context.js";
import { createJwtVerifier } from "../modules/auth/jwt.js";
import type { StoreUser, UserStore } from "../modules/auth/user-store.js";

const ISSUER = "https://auth.example.com";
const AUDIENCE = "https://auth.example.com";
const ALLOWED = "andre@example.com";

const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
const jwk: JWK = { ...(await exportJWK(publicKey)), kid: "test", alg: "EdDSA" };
const verifier = createJwtVerifier({
  keys: createLocalJWKSet({ keys: [jwk] }),
  issuer: ISSUER,
  audience: AUDIENCE,
});

const existing: StoreUser = { id: "user-1", email: ALLOWED, displayName: "Andre" };

async function signJwt(options: {
  sub?: string;
  email?: string;
  emailVerified?: boolean;
  expiration?: string | number;
  issuer?: string;
  key?: CryptoKey;
} = {}): Promise<string> {
  return new SignJWT({ email: options.email ?? ALLOWED, emailVerified: options.emailVerified ?? true })
    .setProtectedHeader({ alg: "EdDSA" })
    .setSubject(options.sub ?? "auth-user-1")
    .setIssuer(options.issuer ?? ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(options.expiration ?? "15m")
    .sign(options.key ?? privateKey);
}

function fakeClient(overrides: Partial<NeonAuthClient> = {}): NeonAuthClient {
  return {
    signUp: vi.fn(async () => undefined),
    verifyEmail: vi.fn(async () => undefined),
    resendVerification: vi.fn(async () => undefined),
    signIn: vi.fn(async () => ({ sessionToken: "rt-1" })),
    fetchToken: vi.fn(async () => signJwt()),
    signOut: vi.fn(async () => undefined),
    forgotPassword: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => undefined),
    ...overrides,
  };
}

function fakeStore(seed: { byAuthId?: StoreUser | null; byEmail?: StoreUser | null; byId?: StoreUser | null } = {}) {
  let created: StoreUser | null = null;
  const store: UserStore = {
    findByAuthId: vi.fn(async () => seed.byAuthId ?? null),
    findUnlinkedByEmail: vi.fn(async () => seed.byEmail ?? null),
    link: vi.fn(async () => true),
    create: vi.fn(async (input) => {
      const user: StoreUser = { id: "created-id", email: input.email, displayName: input.displayName };
      created = user;
      return user;
    }),
    findById: vi.fn(async (id) => {
      if (seed.byId && seed.byId.id === id) return seed.byId;
      if (created && created.id === id) return created;
      if (seed.byAuthId && seed.byAuthId.id === id) return seed.byAuthId;
      if (seed.byEmail && seed.byEmail.id === id) return seed.byEmail;
      return null;
    }),
  };
  return store;
}

const apps: FastifyInstance[] = [];

async function makeApp(overrides: Partial<AuthContext> = {}): Promise<FastifyInstance> {
  const app = await buildApp({
    logger: false,
    auth: {
      neonAuth: null,
      verifier,
      store: fakeStore(),
      allowlist: [ALLOWED],
      webOrigin: "http://localhost:3000",
      ...overrides,
    },
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("POST /auth/sign-up", () => {
  it("201 para e-mail permitido e repassa o corpo ao provedor", async () => {
    const client = fakeClient();
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-up",
      payload: { name: "Andre", email: "Andre@Example.com", password: "senha1234" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ status: "verification_required" });
    expect(client.signUp).toHaveBeenCalledWith({
      name: "Andre",
      email: "andre@example.com",
      password: "senha1234",
    });
  });

  it("403 antes de falar com o Neon quando o e-mail está fora da allowlist", async () => {
    const client = fakeClient();
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-up",
      payload: { name: "Outro", email: "outro@example.com", password: "senha1234" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "not allowed" });
    expect(client.signUp).not.toHaveBeenCalled();
  });

  it("409 quando a conta já existe no provedor", async () => {
    const client = fakeClient({
      signUp: vi.fn(async () => {
        throw new NeonAuthError(422, "USER_ALREADY_EXISTS");
      }),
    });
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-up",
      payload: { name: "Andre", email: ALLOWED, password: "senha1234" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "email already registered" });
  });

  it("400 de validação para senha curta", async () => {
    const app = await makeApp({ neonAuth: fakeClient() });
    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-up",
      payload: { name: "Andre", email: ALLOWED, password: "curta" },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("POST /auth/verify-email e /auth/resend-verification", () => {
  it("204 com código válido", async () => {
    const client = fakeClient();
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-email",
      payload: { email: ALLOWED, otp: "123456" },
    });

    expect(res.statusCode).toBe(204);
    expect(client.verifyEmail).toHaveBeenCalledWith({ email: ALLOWED, otp: "123456" });
  });

  it("400 `invalid code` quando o provedor recusa o código", async () => {
    const client = fakeClient({
      verifyEmail: vi.fn(async () => {
        throw new NeonAuthError(400, "INVALID_OTP");
      }),
    });
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/verify-email",
      payload: { email: ALLOWED, otp: "000000" },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid code" });
  });

  it("resend responde 204 mesmo com o provedor fora do ar", async () => {
    const client = fakeClient({
      resendVerification: vi.fn(async () => {
        throw new NeonAuthError(0, "unavailable");
      }),
    });
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/resend-verification",
      payload: { email: ALLOWED },
    });

    expect(res.statusCode).toBe(204);
  });
});

describe("POST /auth/sign-in", () => {
  it("200 com AuthSessionDto e liga o User antigo de mesmo e-mail", async () => {
    const token = await signJwt();
    const client = fakeClient({ fetchToken: vi.fn(async () => token) });
    const store = fakeStore({ byEmail: existing });
    const app = await makeApp({ neonAuth: client, store });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: ALLOWED, password: "senha1234" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      accessToken: string;
      accessTokenExpiresAt: string;
      refreshToken: string;
      user: StoreUser;
    };
    expect(body.accessToken).toBe(token);
    expect(body.refreshToken).toBe("rt-1");
    expect(body.user).toEqual(existing);
    expect(new Date(body.accessTokenExpiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(store.link).toHaveBeenCalledWith("auth-user-1", "user-1");
  });

  it("cria Índice vazio no primeiro login de e-mail permitido", async () => {
    const client = fakeClient();
    const store = fakeStore();
    const app = await makeApp({ neonAuth: client, store });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: ALLOWED, password: "senha1234" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().user).toEqual({ id: "created-id", email: ALLOWED, displayName: "andre" });
    expect(store.create).toHaveBeenCalledWith({
      email: ALLOWED,
      displayName: "andre",
      authUserId: "auth-user-1",
    });
  });

  it("403 `not allowed` sem criar User quando o e-mail não está na lista", async () => {
    const store = fakeStore();
    const app = await makeApp({ neonAuth: fakeClient(), store, allowlist: ["outra@example.com"] });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: ALLOWED, password: "senha1234" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "not allowed" });
    expect(store.create).not.toHaveBeenCalled();
    expect(store.findUnlinkedByEmail).not.toHaveBeenCalled();
  });

  it("403 `email not verified` quando o JWT diz que a conta não foi verificada", async () => {
    const client = fakeClient({ fetchToken: vi.fn(async () => signJwt({ emailVerified: false })) });
    const store = fakeStore();
    const app = await makeApp({ neonAuth: client, store });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: ALLOWED, password: "senha1234" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "email not verified" });
    expect(store.findByAuthId).not.toHaveBeenCalled();
  });

  it("401 `invalid credentials` com senha errada", async () => {
    const client = fakeClient({
      signIn: vi.fn(async () => {
        throw new NeonAuthError(401, "INVALID_EMAIL_OR_PASSWORD");
      }),
    });
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: ALLOWED, password: "errada" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid credentials" });
  });

  it("403 `email not verified` quando o provedor bloqueia a entrada", async () => {
    const client = fakeClient({
      signIn: vi.fn(async () => {
        throw new NeonAuthError(403, "EMAIL_NOT_VERIFIED");
      }),
    });
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: ALLOWED, password: "senha1234" },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "email not verified" });
  });

  it("502 quando o provedor cai", async () => {
    const client = fakeClient({
      signIn: vi.fn(async () => {
        throw new NeonAuthError(0, "unavailable");
      }),
    });
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: ALLOWED, password: "senha1234" },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: "auth unavailable" });
  });

  it("limita a 10 tentativas por minuto por IP", async () => {
    const client = fakeClient({
      signIn: vi.fn(async () => {
        throw new NeonAuthError(401, "INVALID_EMAIL_OR_PASSWORD");
      }),
    });
    const app = await makeApp({ neonAuth: client });
    const payload = { email: ALLOWED, password: "errada" };

    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const res = await app.inject({ method: "POST", url: "/auth/sign-in", payload });
      statuses.push(res.statusCode);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses[10]).toBe(429);
  });

  it("X-Forwarded-For forjado não burla o limite por IP", async () => {
    const client = fakeClient({
      signIn: vi.fn(async () => {
        throw new NeonAuthError(401, "INVALID_EMAIL_OR_PASSWORD");
      }),
    });
    const app = await makeApp({ neonAuth: client });
    const payload = { email: ALLOWED, password: "errada" };

    const statuses: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/sign-in",
        payload,
        // O cliente forja a primeira entrada; o Cloud Run anexa o IP real à
        // direita. Com `trustProxy: 1`, a chave do limite é o IP real.
        remoteAddress: "10.0.0.5",
        headers: { "x-forwarded-for": `203.0.113.${i + 1}, 198.51.100.7` },
      });
      statuses.push(res.statusCode);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses[10]).toBe(429);
  });
});

describe("POST /auth/refresh", () => {
  it("200 com AccessTokenDto novo", async () => {
    const token = await signJwt();
    const client = fakeClient({ fetchToken: vi.fn(async () => token) });
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: "rt-old" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ accessToken: token });
    expect(client.fetchToken).toHaveBeenCalledWith("rt-old");
  });

  it("401 `invalid session` quando o refresh foi revogado", async () => {
    const client = fakeClient({
      fetchToken: vi.fn(async () => {
        throw new NeonAuthError(401, "INVALID_SESSION");
      }),
    });
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: "rt-revogado" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid session" });
  });
});

describe("sign-out, forgot-password e reset-password", () => {
  it("sign-out é idempotente: 204 mesmo com erro do provedor", async () => {
    const client = fakeClient({
      signOut: vi.fn(async () => {
        throw new NeonAuthError(0, "unavailable");
      }),
    });
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/sign-out",
      payload: { refreshToken: "rt-1" },
    });

    expect(res.statusCode).toBe(204);
    expect(client.signOut).toHaveBeenCalledWith("rt-1");
  });

  it("forgot-password sempre 204 e aponta o link para a web", async () => {
    const client = fakeClient({
      forgotPassword: vi.fn(async () => {
        throw new NeonAuthError(0, "unavailable");
      }),
    });
    const app = await makeApp({ neonAuth: client });

    const res = await app.inject({
      method: "POST",
      url: "/auth/forgot-password",
      payload: { email: ALLOWED },
    });

    expect(res.statusCode).toBe(204);
    expect(client.forgotPassword).toHaveBeenCalledWith({
      email: ALLOWED,
      redirectTo: "http://localhost:3000/redefinir-senha",
    });
  });

  it("reset-password: 204 no sucesso e 400 `invalid token` no link vencido", async () => {
    const ok = await makeApp({ neonAuth: fakeClient() });
    expect(
      (
        await ok.inject({
          method: "POST",
          url: "/auth/reset-password",
          payload: { token: "tk", newPassword: "novasenha1" },
        })
      ).statusCode,
    ).toBe(204);

    const failing = fakeClient({
      resetPassword: vi.fn(async () => {
        throw new NeonAuthError(400, "INVALID_TOKEN");
      }),
    });
    const app = await makeApp({ neonAuth: failing });
    const res = await app.inject({
      method: "POST",
      url: "/auth/reset-password",
      payload: { token: "vencido", newPassword: "novasenha1" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "invalid token" });
  });
});

describe("GET /me", () => {
  it("200 MeDto com JWT válido e User já ligado", async () => {
    const app = await makeApp({ store: fakeStore({ byAuthId: existing }) });

    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${await signJwt()}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(existing);
  });

  it("401 sem credencial", async () => {
    const app = await makeApp();
    const res = await app.inject({ method: "GET", url: "/me" });
    expect(res.statusCode).toBe(401);
  });

  it("401 com JWT vencido", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${await signJwt({ expiration: Math.floor(Date.now() / 1000) - 60 })}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid token" });
  });

  it("401 com assinatura de outra chave", async () => {
    const { privateKey: outraChave } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
    const app = await makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${await signJwt({ key: outraChave })}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("401 com emissor de outro ambiente", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${await signJwt({ issuer: "https://auth-qa.example.com" })}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("403 `not allowed` antes de tocar no banco", async () => {
    const store = fakeStore({ byAuthId: existing });
    const app = await makeApp({ store, allowlist: ["outra@example.com"] });

    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${await signJwt()}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "not allowed" });
    expect(store.findByAuthId).not.toHaveBeenCalled();
  });

  it("403 `email not verified` em toda rota", async () => {
    const app = await makeApp();
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${await signJwt({ emailVerified: false })}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: "email not verified" });
  });

  it("cria o User no primeiro acesso com JWT (conta criada fora da nossa fachada)", async () => {
    const store = fakeStore();
    const app = await makeApp({ store });

    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${await signJwt()}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: "created-id", email: ALLOWED, displayName: "andre" });
  });
});

describe("auth não configurado", () => {
  it("/auth/* responde 503 e o caminho JWT fica desligado", async () => {
    const app = await makeApp({ neonAuth: null, verifier: null });

    const signIn = await app.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: ALLOWED, password: "senha1234" },
    });
    expect(signIn.statusCode).toBe(503);
    expect(signIn.json()).toEqual({ error: "auth not configured" });

    const me = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${await signJwt()}` },
    });
    expect(me.statusCode).toBe(401);
    expect(me.json()).toEqual({ error: "invalid token" });
  });

  it("em NODE_ENV=production a API não sobe e diz qual variável falta", async () => {
    const keys = ["NEON_AUTH_BASE_URL", "AUTH_WEB_ORIGIN", "INDICE_ALLOWED_EMAILS"];
    const savedEnv: Record<string, string | undefined> = {
      NODE_ENV: process.env.NODE_ENV,
      ...Object.fromEntries(keys.map((key) => [key, process.env[key]])),
    };
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = "production";

    try {
      await expect(buildApp({ logger: false })).rejects.toThrow(
        "configuração de auth ausente em NODE_ENV=production: NEON_AUTH_BASE_URL, AUTH_WEB_ORIGIN, INDICE_ALLOWED_EMAILS",
      );
    } finally {
      if (savedEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = savedEnv.NODE_ENV;
      for (const key of keys) {
        const value = savedEnv[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
