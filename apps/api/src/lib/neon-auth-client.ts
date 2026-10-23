// ─────────────────────────────────────────────────────────────────────────────
// Único lugar do código que conhece o protocolo servidor a servidor do Neon
// Auth (Managed Better Auth 1.7.6). Confirmado pelo spike final da WP01
// (`.claude/specs/current/003-login-multiusuario/spike-neon-auth.md`):
// - cookie `__Secure-neon-auth.session_token` (com hífen);
// - o refresh é o valor INTEIRO do cookie (`token.assinatura`, URL-encoded),
//   não o token do corpo do sign-in; a API não decodifica nem reconstrói;
// - `GET /token` com `Cookie` devolve 200 `{ "token": "<jwt>" }`;
// - JWT EdDSA de 900 s, `iss`/`aud` = origem da Auth URL (sem `/neondb/auth`);
// - OTP de 6 dígitos; reset por `POST /request-password-reset` com link
//   `?token=`.
// ─────────────────────────────────────────────────────────────────────────────
export const NEON_AUTH_PROTOCOL_CONFIRMED = true;

export const NEON_AUTH_PROTOCOL = {
  jwksPath: "/.well-known/jwks.json",
  token: "/token", // GET com Cookie → 200 { token }
  sessionCookie: "__Secure-neon-auth.session_token",
  signUp: "/sign-up/email",
  verifyEmail: "/email-otp/verify-email",
  resendVerification: "/email-otp/send-verification-otp",
  signIn: "/sign-in/email",
  signOut: "/sign-out",
  requestPasswordReset: "/request-password-reset",
  resetPassword: "/reset-password",
  otpLength: 6, // `VerifyEmailInput` em packages/shared usa \d{6}
  resetTokenParam: "token", // link de reset → /redefinir-senha?token=
} as const;

export class NeonAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`neon auth ${status} ${code}`);
    this.name = "NeonAuthError";
  }
}

export interface NeonAuthClient {
  signUp(input: { name: string; email: string; password: string }): Promise<void>;
  verifyEmail(input: { email: string; otp: string }): Promise<void>;
  resendVerification(email: string): Promise<void>;
  signIn(input: { email: string; password: string }): Promise<{ sessionToken: string }>;
  /** Troca o token de sessão (refresh) pelo JWT de 15 minutos. */
  fetchToken(sessionToken: string): Promise<string>;
  signOut(sessionToken: string): Promise<void>;
  forgotPassword(input: { email: string; redirectTo?: string }): Promise<void>;
  resetPassword(input: { token: string; newPassword: string }): Promise<void>;
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function createNeonAuthClient(options: {
  baseUrl: string;
  /** `AUTH_WEB_ORIGIN`: o Neon Auth só aceita chamadas de origem confiável. */
  origin: string;
  timeoutMs?: number;
  fetch?: FetchLike;
}): NeonAuthClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const origin = options.origin;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const doFetch: FetchLike = options.fetch ?? fetch;

  async function request(
    path: string,
    init: { method: "GET" | "POST"; body?: unknown; sessionToken?: string },
  ): Promise<Response> {
    const headers: Record<string, string> = { Origin: origin, Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    // O refresh já vem URL-encoded do `Set-Cookie`; não decodificar nem
    // recodificar, senão o `/token` responde 401.
    if (init.sessionToken) headers.Cookie = `${NEON_AUTH_PROTOCOL.sessionCookie}=${init.sessionToken}`;

    let response: Response;
    try {
      response = await doFetch(`${baseUrl}${path}`, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // Rede, DNS ou timeout de 10 s: a rota traduz em 502.
      throw new NeonAuthError(0, "unavailable");
    }

    if (!response.ok) throw await errorFrom(response);
    return response;
  }

  return {
    async signUp(input) {
      await request(NEON_AUTH_PROTOCOL.signUp, { method: "POST", body: input });
    },

    async verifyEmail(input) {
      await request(NEON_AUTH_PROTOCOL.verifyEmail, { method: "POST", body: input });
    },

    async resendVerification(email) {
      await request(NEON_AUTH_PROTOCOL.resendVerification, {
        method: "POST",
        body: { email, type: "email-verification" },
      });
    },

    async signIn(input) {
      const response = await request(NEON_AUTH_PROTOCOL.signIn, { method: "POST", body: input });
      const cookie = sessionTokenFromSetCookie(response.headers);
      // O refresh tem de ser o valor inteiro do cookie (`token.assinatura`);
      // o `token` do corpo do sign-in sozinho responde 401 em `/token`.
      if (!cookie) throw new NeonAuthError(0, "missing session token");
      return { sessionToken: cookie };
    },

    async fetchToken(sessionToken) {
      const response = await request(NEON_AUTH_PROTOCOL.token, { method: "GET", sessionToken });
      const body = await readJson(response);
      const token = typeof body.token === "string" ? body.token : null;
      if (!token) throw new NeonAuthError(0, "missing access token");
      return token;
    },

    async signOut(sessionToken) {
      await request(NEON_AUTH_PROTOCOL.signOut, { method: "POST", body: {}, sessionToken });
    },

    async forgotPassword(input) {
      await request(NEON_AUTH_PROTOCOL.requestPasswordReset, {
        method: "POST",
        body: input.redirectTo ? { email: input.email, redirectTo: input.redirectTo } : { email: input.email },
      });
    },

    async resetPassword(input) {
      await request(NEON_AUTH_PROTOCOL.resetPassword, {
        method: "POST",
        body: { token: input.token, newPassword: input.newPassword },
      });
    },
  };
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function errorFrom(response: Response): Promise<NeonAuthError> {
  const body = await readJson(response);
  const code =
    typeof body.code === "string" && body.code
      ? body.code
      : typeof body.message === "string" && body.message
        ? body.message
        : "unknown";
  return new NeonAuthError(response.status, code);
}

/**
 * Lê o token de sessão do `Set-Cookie` do sign-in. O valor é devolvido como
 * veio (URL-encoded): ele é o refresh inteiro que volta no `Cookie` do `/token`.
 * Aceita também o nome sem o prefixo `__Secure-`, usado em ambiente local.
 */
export function sessionTokenFromSetCookie(
  headers: Headers,
  cookieName: string = NEON_AUTH_PROTOCOL.sessionCookie,
): string | null {
  const localName = cookieName.replace(/^__Secure-/, "");
  const cookies = setCookies(headers);
  for (const cookie of cookies) {
    const pair = cookie.split(";")[0] ?? "";
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    if (name !== cookieName && name !== localName) continue;
    const value = pair.slice(separator + 1).trim();
    if (value) return value;
  }
  return null;
}

function setCookies(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof getSetCookie === "function") return getSetCookie.call(headers);

  const combined = headers.get("set-cookie");
  if (!combined) return [];
  // Fallback simples: não usa vírgula dentro de `Expires` porque o nome do
  // cookie procurado não contém vírgula.
  return combined.split(/,(?=\s*[^;,=]+=)/);
}
