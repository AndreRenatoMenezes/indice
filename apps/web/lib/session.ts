// Sessão da web: os dois cookies httpOnly e as chamadas a `/auth/*` da API.
// É o único lugar do app que lê/grava `indice_rt` e `indice_at` e que fala com
// a fachada de auth — páginas e actions só usam o que está exportado aqui.
import { cookies } from "next/headers";
import type { AccessTokenDto, AuthSessionDto } from "@indice/shared";

export const REFRESH_COOKIE = "indice_rt";
export const ACCESS_COOKIE = "indice_at";

const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

// Janela deslizante da sessão: fechar o navegador não desloga. O middleware
// regrava o refresh com mais 7 dias a cada renovação bem-sucedida.
export const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

// Em produção os cookies só viajam por HTTPS; no dev local (http) ficam sem Secure.
const COOKIE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** Erro tipado da fachada `/auth/*`: `{ status, code }` no lugar de string solta. */
export class AuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`auth ${status} ${code}`);
    this.name = "AuthError";
  }
}

/**
 * POST na fachada de auth. Corpo de erro da API é `{ error: string }`; falha de
 * rede (API/Neon fora do ar) vira 502 para as telas mostrarem a mensagem padrão.
 */
async function call<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new AuthError(502, "auth unavailable");
  }

  if (!res.ok) {
    let code = "unknown";
    try {
      const parsed = (await res.json()) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error) code = parsed.error;
    } catch {
      // 204/erro sem corpo: mantém o código genérico.
    }
    throw new AuthError(res.status, code);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ── Fachada `/auth/*` ────────────────────────────────────────────────────────
export const requestSignUp = (input: { name: string; email: string; password: string }) =>
  call<void>("/auth/sign-up", input);

export const requestVerifyEmail = (input: { email: string; otp: string }) =>
  call<void>("/auth/verify-email", input);

export const requestResendVerification = (email: string) =>
  call<void>("/auth/resend-verification", { email });

export const requestSignIn = (input: { email: string; password: string }) =>
  call<AuthSessionDto>("/auth/sign-in", input);

export const requestRefresh = (refreshToken: string) =>
  call<AccessTokenDto>("/auth/refresh", { refreshToken });

export const requestSignOut = (refreshToken: string) =>
  call<void>("/auth/sign-out", { refreshToken });

export const requestForgotPassword = (email: string) =>
  call<void>("/auth/forgot-password", { email });

export const requestResetPassword = (input: { token: string; newPassword: string }) =>
  call<void>("/auth/reset-password", input);

// ── Cookies ──────────────────────────────────────────────────────────────────
function secondsUntil(iso: string): number {
  const ms = Date.parse(iso) - Date.now();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 15 * 60;
}

/** Grava a sessão nova do sign-in. O refresh vale 7 dias e desliza no middleware. */
export async function saveSession(session: AuthSessionDto): Promise<void> {
  const jar = await cookies();
  jar.set(REFRESH_COOKIE, session.refreshToken, { ...COOKIE, maxAge: REFRESH_MAX_AGE });
  jar.set(ACCESS_COOKIE, session.accessToken, {
    ...COOKIE,
    maxAge: secondsUntil(session.accessTokenExpiresAt),
  });
}

/** Apaga os dois cookies (logout e refresh recusado). */
export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const gone = { ...COOKIE, maxAge: 0 };
  jar.set(REFRESH_COOKIE, "", gone);
  jar.set(ACCESS_COOKIE, "", gone);
}

export async function getAccessToken(): Promise<string | null> {
  return (await cookies()).get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return (await cookies()).get(REFRESH_COOKIE)?.value ?? null;
}
