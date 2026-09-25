import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { prisma } from "@indice/db";
import { config } from "./config.js";
import { authPlugin } from "./plugins/auth.js";
import { dailySummaryRoutes } from "./routes/daily-summary.js";
import { entriesRoutes } from "./routes/entries.js";
import { recurrenceRoutes } from "./routes/recurrence.js";
import { habitsRoutes } from "./routes/habits.js";
import { financeRoutes } from "./routes/finance.js";
import { goalsRoutes } from "./routes/goals.js";
import { mediaRoutes } from "./routes/media.js";

export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
    trustProxy: true, // Cloud Run termina TLS na frente
  });

  await app.register(cors, { origin: config.corsOrigin === "*" ? true : config.corsOrigin.split(","), credentials: true });
  await app.register(sensible);

  // A API fica pública no Cloud Run; só a chave protege. O limite contém força
  // bruta na chave e engano de cliente, com folga para uso normal do app.
  // `global: false` + hook de instância: os hooks de rota do plugin rodariam
  // depois do `authPlugin`, e chave inválida nunca seria contada.
  await app.register(rateLimit, {
    global: false,
    max: config.rateLimitMax,
    timeWindow: "1 minute",
    // Por chave de API quando houver: um único IP pode ser o web e o celular.
    keyGenerator: (req) => {
      const key = req.headers["x-api-key"];
      if (typeof key === "string" && key) return key;
      const auth = req.headers.authorization;
      if (auth?.startsWith("Bearer ")) return auth.slice(7);
      return req.ip;
    },
  });
  app.addHook("onRequest", app.rateLimit());

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

  await app.register(authPlugin);
  await app.register(dailySummaryRoutes);
  await app.register(entriesRoutes);
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
