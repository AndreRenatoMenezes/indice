// Autenticação por chave de API (`X-Api-Key`/`Bearer <chave>`, para automações)
// ou por JWT do Neon Auth (`Authorization: Bearer <jwt>`, web e Android).
// O JWT é verificado localmente pelo JWKS e, em toda requisição, passa pela
// allowlist e pelo vínculo `User.authUserId` — é aqui que a autorização vale,
// independentemente de quem conseguiu criar conta direto no Neon Auth.
import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "@indice/db";
import { config } from "../config.js";
import { isAllowed } from "../modules/auth/allowlist.js";
import type { AuthContext } from "../modules/auth/context.js";
import { classifyCredential } from "../modules/auth/credential.js";
import { resolveOrLinkUser } from "../modules/auth/resolve-user.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Rotas que não passam pelo hook: `/health` e a fachada pública `/auth/*`. */
export function isPublicPath(url: string): boolean {
  return (
    url === "/health" ||
    url.startsWith("/health?") ||
    url === "/auth" ||
    url.startsWith("/auth/")
  );
}

let devUserId: string | null = null;
async function resolveDevUser(): Promise<string> {
  if (devUserId) return devUserId;
  const user = await prisma.user.upsert({
    where: { email: config.devUserEmail },
    update: {},
    create: { email: config.devUserEmail, displayName: "Dev", settings: { create: {} } },
  });
  devUserId = user.id;
  return user.id;
}

async function authenticateApiKey(req: FastifyRequest, key: string, reply: FastifyReply) {
  if (config.devApiKey && key === config.devApiKey) {
    req.userId = await resolveDevUser();
    return;
  }
  const row = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
  if (!row || row.revokedAt || (row.expiresAt && row.expiresAt < new Date())) {
    reply.code(401).send({ error: "invalid api key" });
    return;
  }
  req.userId = row.userId;
  void prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
}

export const authPlugin = fp<{ auth: AuthContext }>(async (app: FastifyInstance, opts) => {
  const auth = opts.auth;

  app.decorateRequest("userId", "");

  app.addHook("onRequest", async (req, reply) => {
    if (isPublicPath(req.url)) return;

    const credential = classifyCredential(req.headers);
    if (!credential) return reply.code(401).send({ error: "missing credential" });

    if (credential.kind === "apiKey") return authenticateApiKey(req, credential.value, reply);

    // ── JWT do Neon Auth ────────────────────────────────────────────────────
    // Fora de produção sem Auth configurado o caminho JWT fica desligado.
    if (!auth.verifier) return reply.code(401).send({ error: "invalid token" });

    let claims;
    try {
      claims = await auth.verifier(credential.value);
    } catch {
      return reply.code(401).send({ error: "invalid token" });
    }

    if (!claims.emailVerified) return reply.code(403).send({ error: "email not verified" });
    if (!isAllowed(auth.allowlist, claims.email)) return reply.code(403).send({ error: "not allowed" });

    const result = await resolveOrLinkUser(auth.store, claims, true);
    if ("error" in result) return reply.code(403).send({ error: result.error });

    // Allowlist também pelo e-mail do `User` resolvido (plan.md, 003).
    if (!isAllowed(auth.allowlist, result.user.email)) {
      return reply.code(403).send({ error: "not allowed" });
    }

    req.userId = result.user.id;
  });
});
