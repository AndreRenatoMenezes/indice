import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { prisma } from "@indice/db";
import { config, missingAuthEnv } from "./config.js";
import { NEON_AUTH_PROTOCOL_CONFIRMED } from "./lib/neon-auth-client.js";
import { createAuthContext, type AuthContext } from "./modules/auth/context.js";
import { authPlugin } from "./plugins/auth.js";
import { authRoutes } from "./routes/auth.js";
import { dailySummaryRoutes } from "./routes/daily-summary.js";
import { entriesRoutes } from "./routes/entries.js";
import { listsRoutes } from "./routes/lists.js";
import { recurrenceRoutes } from "./routes/recurrence.js";
import { habitsRoutes } from "./routes/habits.js";
import { financeRoutes } from "./routes/finance.js";
import { goalsRoutes } from "./routes/goals.js";
import { mediaRoutes } from "./routes/media.js";

export type AppOptions = {
  /** Injetado nos testes; em produção sai de `createAuthContext()`. */
  auth?: AuthContext;
  logger?: boolean;
};

// Cloud Run termina o TLS e é o único proxy na frente do container: o serviço
// é exposto direto em `*.run.app`, sem balanceador no cloudbuild. Confiar em 1
// salto é o mesmo que `trust: 1` do proxy-addr: só o socket é confiável e o
// `req.ip` vem da última entrada do X-Forwarded-For (a que o Cloud Run anexa),
// ignorando valores forjados à esquerda. Se um balanceador externo entrar na
// frente, o número de saltos confiáveis muda junto.
const TRUSTED_PROXY_HOPS = 1;

export async function buildApp(options: AppOptions = {}) {
  // Em produção a API não sobe sem a configuração de auth, e diz o que falta.
  const missing = missingAuthEnv();
  if (missing.length) {
    throw new Error(`configuração de auth ausente em NODE_ENV=production: ${missing.join(", ")}`);
  }

  const app = Fastify({
    logger: options.logger === false ? false : { level: process.env.LOG_LEVEL ?? "info" },
    trustProxy: (_address, hop) => hop < TRUSTED_PROXY_HOPS,
  });

  const auth = options.auth ?? createAuthContext();
  if (auth.neonAuth && !NEON_AUTH_PROTOCOL_CONFIRMED) {
    app.log.warn("Neon Auth habilitado com protocolo provisório: aguardando o spike da WP01");
  }

  await app.register(cors, { origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","), credentials: true });
  await app.register(sensible);

  // A API fica pública no Cloud Run; só a credencial protege. O limite contém
  // força bruta e engano de cliente, com folga para uso normal do app.
  // `global: false` + hook de instância: os hooks de rota do plugin rodariam
  // depois do `authPlugin`, e credencial inválida nunca seria contada.
  await app.register(rateLimit, {
    global: false,
    max: config.rateLimitMax,
    timeWindow: "1 minute",
    // Por chave de API ou por JWT quando houver: um único IP pode ser o web e
    // o celular.
    keyGenerator: (req) => {
      const key = req.headers["x-api-key"];
      if (typeof key === "string" && key) return key;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) return authHeader.slice(7);
      return req.ip;
    },
  });
  // `/auth/*` usa o limite próprio da rota (10/min por IP); as demais rotas,
  // o limite por credencial acima.
  const dataLimiter = app.rateLimit();
  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/auth" || req.url.startsWith("/auth/")) return;
    return dataLimiter.call(app, req, reply);
  });

  // Aceita POST com content-type JSON e corpo vazio (Cloud Scheduler, widgets):
  // o parser padrão do Fastify rejeita, e várias rotas de ação não precisam de corpo.
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
    if (!body || !String(body).trim()) return done(null, {});
    try { done(null, JSON.parse(String(body))); } catch (e) { done(e as Error, undefined); }
  });

  app.get("/health", async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, service: "indice-api", time: new Date().toISOString() };
  });

  await app.register(authPlugin, { auth });
  await app.register(authRoutes, { auth });
  await app.register(dailySummaryRoutes);
  await app.register(entriesRoutes);
  await app.register(listsRoutes);
  await app.register(recurrenceRoutes);
  await app.register(habitsRoutes);
  await app.register(financeRoutes);
  await app.register(goalsRoutes);
  await app.register(mediaRoutes);

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    app.log.error(err);
    const status = err.statusCode ?? 500;
    reply.code(status).send({ error: status >= 500 ? "internal error" : err.message });
  });

  app.addHook("onClose", async () => { await prisma.$disconnect(); });
  return app;
}
