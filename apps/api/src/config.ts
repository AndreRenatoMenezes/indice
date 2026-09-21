export const config = {
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 8080),
  host: process.env.API_HOST ?? "0.0.0.0",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  // Chave estática de desenvolvimento: evita seed só para subir a API local.
  devApiKey: process.env.NODE_ENV === "production" ? null : (process.env.INDICE_API_KEY ?? "dev-local-key"),
  devUserEmail: process.env.INDICE_USER_EMAIL ?? "andre@indice.local",
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 300),
  timezone: process.env.TZ ?? "America/Sao_Paulo",
} as const;
