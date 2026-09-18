// Autenticação por chave de API (header `X-Api-Key` ou `Authorization: Bearer`).
// Único usuário hoje; a chave resolve o `userId` e todas as rotas filtram por ele.
// Em dev, `INDICE_API_KEY` (default "dev-local-key") resolve para o usuário do
// seed sem precisar de hash no banco — e cria esse usuário se não existir.
import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "@indice/db";
import { config } from "../config.js";

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function extractKey(req: FastifyRequest): string | null {
  const h = req.headers["x-api-key"];
  if (typeof h === "string" && h) return h;
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
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

export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorateRequest("userId", "");
  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health" || req.url.startsWith("/health?")) return;
    const key = extractKey(req);
    if (!key) return reply.code(401).send({ error: "missing api key" });

    if (config.devApiKey && key === config.devApiKey) {
      req.userId = await resolveDevUser();
      return;
    }
    const row = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
    if (!row || row.revokedAt || (row.expiresAt && row.expiresAt < new Date())) {
      return reply.code(401).send({ error: "invalid api key" });
    }
    req.userId = row.userId;
    void prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  });
});
