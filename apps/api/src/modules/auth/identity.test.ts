import { describe, expect, it } from "vitest";
import { decideIdentity } from "./identity.js";

const claims = { sub: "auth-1", email: "andre@example.com", emailVerified: true };
const user = { id: "user-1" };

describe("decideIdentity", () => {
  it("usa o User já ligado ao sub", () => {
    expect(decideIdentity({ byAuthId: user, byEmail: null, claims, allowed: true })).toEqual({
      action: "use",
      id: "user-1",
    });
  });

  it("liga ao User de mesmo e-mail quando ele ainda não tem login", () => {
    expect(decideIdentity({ byAuthId: null, byEmail: user, claims, allowed: true })).toEqual({
      action: "link",
      id: "user-1",
    });
  });

  it("cria Índice vazio quando não há User de mesmo e-mail", () => {
    expect(decideIdentity({ byAuthId: null, byEmail: null, claims, allowed: true })).toEqual({ action: "create" });
  });

  it("nega conta de e-mail não verificado, mesmo já ligada", () => {
    const unverified = { ...claims, emailVerified: false };
    expect(decideIdentity({ byAuthId: user, byEmail: null, claims: unverified, allowed: true })).toEqual({
      action: "deny",
      error: "email not verified",
    });
    expect(decideIdentity({ byAuthId: null, byEmail: null, claims: unverified, allowed: true })).toEqual({
      action: "deny",
      error: "email not verified",
    });
  });

  it("nega quem está fora da allowlist em toda saída (use, link e create)", () => {
    expect(decideIdentity({ byAuthId: user, byEmail: null, claims, allowed: false })).toEqual({
      action: "deny",
      error: "not allowed",
    });
    expect(decideIdentity({ byAuthId: null, byEmail: user, claims, allowed: false })).toEqual({
      action: "deny",
      error: "not allowed",
    });
    expect(decideIdentity({ byAuthId: null, byEmail: null, claims, allowed: false })).toEqual({
      action: "deny",
      error: "not allowed",
    });
  });
});
