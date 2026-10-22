import { describe, expect, it } from "vitest";
import { authOrigin, missingAuthEnv } from "./config.js";

const complete = {
  NODE_ENV: "production",
  NEON_AUTH_BASE_URL: "https://auth.example.com/neondb/auth",
  AUTH_WEB_ORIGIN: "https://indice.example.com",
  INDICE_ALLOWED_EMAILS: "andre@example.com",
};

describe("missingAuthEnv", () => {
  it("em produção, aponta cada variável ausente pelo nome", () => {
    expect(missingAuthEnv({ NODE_ENV: "production" })).toEqual([
      "NEON_AUTH_BASE_URL",
      "AUTH_WEB_ORIGIN",
      "INDICE_ALLOWED_EMAILS",
    ]);
    expect(
      missingAuthEnv({ NODE_ENV: "production", NEON_AUTH_BASE_URL: "https://auth.example.com" }),
    ).toEqual(["AUTH_WEB_ORIGIN", "INDICE_ALLOWED_EMAILS"]);
  });

  it("valor vazio ou só espaço conta como ausente", () => {
    expect(missingAuthEnv({ ...complete, AUTH_WEB_ORIGIN: "   " })).toEqual(["AUTH_WEB_ORIGIN"]);
    expect(missingAuthEnv({ ...complete, INDICE_ALLOWED_EMAILS: "" })).toEqual(["INDICE_ALLOWED_EMAILS"]);
  });

  it("com tudo configurado, não falta nada", () => {
    expect(missingAuthEnv(complete)).toEqual([]);
  });

  it("fora de produção, nada é obrigatório", () => {
    expect(missingAuthEnv({ NODE_ENV: "development" })).toEqual([]);
    expect(missingAuthEnv({})).toEqual([]);
  });
});

describe("authOrigin", () => {
  it("devolve a origem da Auth URL (iss e aud do JWT)", () => {
    expect(authOrigin("https://auth.example.com/neondb/auth")).toBe("https://auth.example.com");
    expect(authOrigin("http://127.0.0.1:5432/neondb/auth")).toBe("http://127.0.0.1:5432");
  });
});
