// Variáveis de ambiente da API. `config` é lido uma vez na subida; o que precisa
// ser decidido por requisição (allowlist, credencial) fica nos módulos de auth.
const env = process.env;

function trimmed(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

// Sem barra final para concatenar caminhos do Neon Auth sem `//`.
function withoutTrailingSlash(value: string | null): string | null {
  return value ? value.replace(/\/+$/, "") : null;
}

// Em produção a API não sobe sem estes três. Fora de produção são opcionais:
// sem `NEON_AUTH_BASE_URL`, `/auth/*` responde 503 e o caminho JWT fica desligado
// (a `dev-local-key` continua valendo para curl e testes).
export const AUTH_ENV_KEYS = ["NEON_AUTH_BASE_URL", "AUTH_WEB_ORIGIN", "INDICE_ALLOWED_EMAILS"] as const;

export function missingAuthEnv(source: Record<string, string | undefined> = process.env): string[] {
  if (source.NODE_ENV !== "production") return [];
  return AUTH_ENV_KEYS.filter((key) => !(source[key] ?? "").trim());
}

// `iss` e `aud` do JWT do Neon Auth são a origem da Auth URL (plan.md, 003).
export function authOrigin(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

export const config = {
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 8080),
  host: process.env.API_HOST ?? "0.0.0.0",
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  // Chave estática de desenvolvimento: evita seed só para subir a API local.
  devApiKey: process.env.NODE_ENV === "production" ? null : (process.env.INDICE_API_KEY ?? "dev-local-key"),
  devUserEmail: process.env.INDICE_USER_EMAIL ?? "andre@indice.local",
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 300),
  timezone: process.env.TZ ?? "America/Sao_Paulo",
  neonAuthBaseUrl: withoutTrailingSlash(trimmed(env.NEON_AUTH_BASE_URL)),
  authWebOrigin: withoutTrailingSlash(trimmed(env.AUTH_WEB_ORIGIN)),
  allowedEmailsRaw: env.INDICE_ALLOWED_EMAILS ?? "",
  // Timeout de qualquer chamada ao Neon Auth (plan.md, 003): 10 s.
  authTimeoutMs: 10_000,
  // `/auth/*` tem limite próprio por IP, fixo no código (plan.md, 003).
  authRateLimitMax: 10,
} as const;
