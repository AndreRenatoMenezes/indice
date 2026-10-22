import { describe, expect, it, vi } from "vitest";
import {
  createNeonAuthClient,
  NEON_AUTH_PROTOCOL,
  NeonAuthError,
  sessionTokenFromSetCookie,
  type FetchLike,
} from "./neon-auth-client.js";

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Headers } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: init.headers ?? { "content-type": "application/json" },
  });
}

function cookieResponse(cookies: string[]): Response {
  const headers = new Headers();
  headers.append("content-type", "application/json");
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify({}), { status: 200, headers });
}

function clientWith(response: Response | (() => Promise<Response>), baseUrl = "https://auth.example.com/neondb/auth") {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return typeof response === "function" ? response() : response;
  };
  const client = createNeonAuthClient({
    baseUrl,
    origin: "https://indice.example.com",
    timeoutMs: 10_000,
    fetch: fetchImpl,
  });
  return { client, calls };
}

function headersOf(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>;
}

describe("sessionTokenFromSetCookie", () => {
  it("acha o cookie de sessão no meio de outros", () => {
    const headers = new Headers();
    headers.append("set-cookie", "outro=1; Path=/; HttpOnly");
    headers.append("set-cookie", `${NEON_AUTH_PROTOCOL.sessionCookie}=token-123; Path=/; HttpOnly; Secure`);
    expect(sessionTokenFromSetCookie(headers)).toBe("token-123");
  });

  it("aceita variação sem o prefixo __Secure-", () => {
    const headers = new Headers();
    headers.append("set-cookie", "neonauth.session_token=token-456; Path=/");
    expect(sessionTokenFromSetCookie(headers)).toBe("token-456");
  });

  it("devolve null quando não há cookie de sessão", () => {
    const headers = new Headers();
    headers.append("set-cookie", "outro=1; Path=/");
    expect(sessionTokenFromSetCookie(headers)).toBeNull();
    expect(sessionTokenFromSetCookie(new Headers())).toBeNull();
  });
});

describe("createNeonAuthClient", () => {
  it("sign-in manda Origin, corpo JSON e devolve o token do cookie", async () => {
    const { client, calls } = clientWith(
      cookieResponse([`${NEON_AUTH_PROTOCOL.sessionCookie}=rt-abc; Path=/; HttpOnly`]),
    );

    await expect(client.signIn({ email: "andre@example.com", password: "senha1234" })).resolves.toEqual({
      sessionToken: "rt-abc",
    });

    expect(calls[0]!.url).toBe("https://auth.example.com/neondb/auth/sign-in/email");
    expect(calls[0]!.init.method).toBe("POST");
    expect(headersOf(calls[0]!.init).Origin).toBe("https://indice.example.com");
    expect(headersOf(calls[0]!.init)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ email: "andre@example.com", password: "senha1234" });
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sign-in aceita o token no corpo quando não há cookie", async () => {
    const { client } = clientWith(jsonResponse({ token: "rt-body" }));
    await expect(client.signIn({ email: "a@b.com", password: "x" })).resolves.toEqual({ sessionToken: "rt-body" });
  });

  it("sign-in sem token devolve erro de protocolo", async () => {
    const { client } = clientWith(jsonResponse({}));
    await expect(client.signIn({ email: "a@b.com", password: "x" })).rejects.toMatchObject({
      name: "NeonAuthError",
      code: "missing session token",
    });
  });

  it("fetchToken manda o cookie de sessão e lê `set-auth-jwt`", async () => {
    const headers = new Headers({ "set-auth-jwt": "jwt-header" });
    const { client, calls } = clientWith(new Response(null, { status: 200, headers }));

    await expect(client.fetchToken("rt-abc")).resolves.toBe("jwt-header");
    expect(calls[0]!.url).toBe("https://auth.example.com/neondb/auth/token");
    expect(calls[0]!.init.method).toBe("GET");
    expect(headersOf(calls[0]!.init).Cookie).toBe(`${NEON_AUTH_PROTOCOL.sessionCookie}=rt-abc`);
  });

  it("fetchToken cai no corpo `{ token }`", async () => {
    const { client } = clientWith(jsonResponse({ token: "jwt-body" }));
    await expect(client.fetchToken("rt-abc")).resolves.toBe("jwt-body");
  });

  it("traduz erro HTTP do provedor com status e código", async () => {
    const { client } = clientWith(jsonResponse({ code: "INVALID_EMAIL_OR_PASSWORD" }, { status: 401 }));

    await expect(client.signIn({ email: "a@b.com", password: "errada" })).rejects.toMatchObject({
      status: 401,
      code: "INVALID_EMAIL_OR_PASSWORD",
    });
  });

  it("rede fora ou timeout viram `unavailable`", async () => {
    const { client } = clientWith(async () => {
      throw new Error("ECONNREFUSED");
    });

    await expect(client.fetchToken("rt")).rejects.toBeInstanceOf(NeonAuthError);
    await expect(client.fetchToken("rt")).rejects.toMatchObject({ status: 0, code: "unavailable" });
  });

  it("envia o corpo certo em cada operação", async () => {
    const { client, calls } = clientWith(jsonResponse({}));

    await client.signUp({ name: "Andre", email: "a@b.com", password: "senha1234" });
    await client.verifyEmail({ email: "a@b.com", otp: "123456" });
    await client.resendVerification("a@b.com");
    await client.signOut("rt");
    await client.forgotPassword({ email: "a@b.com", redirectTo: "https://indice.example.com/redefinir-senha" });
    await client.resetPassword({ token: "tk", newPassword: "novasenha1" });

    const bodies = calls.map((call) => JSON.parse(String(call.init.body)) as Record<string, unknown>);
    expect(bodies[0]).toEqual({ name: "Andre", email: "a@b.com", password: "senha1234" });
    expect(bodies[1]).toEqual({ email: "a@b.com", otp: "123456" });
    expect(bodies[2]).toEqual({ email: "a@b.com", type: "email-verification" });
    expect(bodies[3]).toEqual({});
    expect(bodies[4]).toEqual({ email: "a@b.com", redirectTo: "https://indice.example.com/redefinir-senha" });
    expect(bodies[5]).toEqual({ token: "tk", newPassword: "novasenha1" });
    expect(headersOf(calls[3]!.init).Cookie).toBe(`${NEON_AUTH_PROTOCOL.sessionCookie}=rt`);
  });

  it("forgot-password sem origem confiável não manda redirectTo", async () => {
    const { client, calls } = clientWith(jsonResponse({}));
    await client.forgotPassword({ email: "a@b.com" });
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ email: "a@b.com" });
  });

  it("não duplica barra quando a base termina em /", async () => {
    const { client, calls } = clientWith(jsonResponse({}), "https://auth.example.com/neondb/auth/");
    await client.signUp({ name: "A", email: "a@b.com", password: "senha1234" });
    expect(calls[0]!.url).toBe("https://auth.example.com/neondb/auth/sign-up/email");
  });
});
