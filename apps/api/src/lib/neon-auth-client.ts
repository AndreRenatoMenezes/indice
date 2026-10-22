// ─────────────────────────────────────────────────────────────────────────────
// PENDENTE WP01 (spike-neon-auth.md) — único lugar do código que conhece o
// protocolo servidor a servidor do Neon Auth (Managed Better Auth 1.7.6).
//
// [plano]  valores que o plan.md da 003 já fixou a partir da doc do Neon.
// [provisório] valores que o Better Auth 1.7.6 sugere e o spike do Obi tem de
//          confirmar: nomes de endpoint, corpo do `/token`, tamanho do código e
//          parâmetro do link de reset. Se o spike divergir, muda só aqui.
// Enquanto `NEON_AUTH_PROTOCOL_CONFIRMED` for `false`, a API avisa no log ao
// subir com auth configurado; a troca para `true` é o fecho desta pendência.
// ─────────────────────────────────────────────────────────────────────────────
export const NEON_AUTH_PROTOCOL_CONFIRMED = false;

export const NEON_AUTH_PROTOCOL = {
  jwksPath: "/.well-known/jwks.json", // [plano] plan.md, "Estado verificado"
  token: "/token", // [plano] GET /token com o cookie de sessão
  sessionCookie: "__Secure-neonauth.session_token", // [plano] cookie de sessão opaco
  signUp: "/sign-up/email", // [provisório]
  verifyEmail: "/email-otp/verify-email", // [provisório]
  resendVerification: "/email-otp/send-verification-otp", // [provisório]
  signIn: "/sign-in/email", // [provisório]
  signOut: "/sign-out", // [provisório]
  forgotPassword: "/forget-password", // [provisório]
  resetPassword: "/reset-password", // [provisório]
  otpLength: 6, // [provisório] `VerifyEmailInput` em packages/shared usa \d{6}
  resetTokenParam: "token", // [provisório] link de reset → /redefinir-senha?token=
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
        body: { email, type: "email-verification" }, // [provisório] `type` do plugin de OTP
      });
    },

    async signIn(input) {
      const response = await request(NEON_AUTH_PROTOCOL.signIn, { method: "POST", body: input });
      const cookie = sessionTokenFromSetCookie(response.headers);
      if (cookie) return { sessionToken: cookie };

      // [provisório] em alguns modos o Better Auth devolve o token no corpo.
      const body = await readJson(response);
      const token = typeof body.token === "string" ? body.token : null;
      if (token) return { sessionToken: token };
      throw new NeonAuthError(0, "missing session token");
    },

    async fetchToken(sessionToken) {
      const response = await request(NEON_AUTH_PROTOCOL.token, { method: "GET", sessionToken });

      // [provisório] o plano cita o header `set-auth-jwt` no `get-session`;
      // aceitamos também no `/token`, além do corpo `{ token }`.
      const header = response.headers.get("set-auth-jwt");
      if (header) return header;

      const body = await readJson(response);
      const token =
        typeof body.token === "string" ? body.token : typeof body.jwt === "string" ? body.jwt : null;
      if (!token) throw new NeonAuthError(0, "missing access token");
      return token;
    },

    async signOut(sessionToken) {
      await request(NEON_AUTH_PROTOCOL.signOut, { method: "POST", body: {}, sessionToken });
    },

    async forgotPassword(input) {
      await request(NEON_AUTH_PROTOCOL.forgotPassword, {
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
 * Lê o token de sessão do `Set-Cookie` do sign-in. O nome exato vem do spike
 * (WP01); o fallback por sufixo cobre o cookie sem o prefixo `__Secure-` em
 * ambiente local.
 */
export function sessionTokenFromSetCookie(
  headers: Headers,
  cookieName: string = NEON_AUTH_PROTOCOL.sessionCookie,
): string | null {
  const cookies = setCookies(headers);
  for (const cookie of cookies) {
    const pair = cookie.split(";")[0] ?? "";
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    if (name !== cookieName && !name.endsWith("session_token")) continue;
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
