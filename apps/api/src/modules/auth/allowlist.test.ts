import { describe, expect, it } from "vitest";
import { isAllowed, normalizeEmail, parseAllowlist } from "./allowlist.js";

describe("parseAllowlist", () => {
  it("normaliza trim e minúsculas, descarta vazios e repete", () => {
    expect(parseAllowlist(" Andre@Example.com , ana@example.com,,andre@example.com ")).toEqual([
      "andre@example.com",
      "ana@example.com",
    ]);
  });

  it("lista vazia ou ausente vira []", () => {
    expect(parseAllowlist("")).toEqual([]);
    expect(parseAllowlist("   ,  ")).toEqual([]);
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist(null)).toEqual([]);
  });
});

describe("isAllowed", () => {
  const list = parseAllowlist("andre@example.com");

  it("compara sem diferenciar maiúsculas e espaços", () => {
    expect(isAllowed(list, "ANDRE@example.com")).toBe(true);
    expect(isAllowed(list, " andre@example.com ")).toBe(true);
  });

  it("nega quem não está na lista e e-mail ausente", () => {
    expect(isAllowed(list, "outro@example.com")).toBe(false);
    expect(isAllowed(list, "")).toBe(false);
    expect(isAllowed(list, null)).toBe(false);
    expect(isAllowed(list, undefined)).toBe(false);
  });

  it("lista vazia nega todo mundo", () => {
    expect(isAllowed([], "andre@example.com")).toBe(false);
  });
});

describe("normalizeEmail", () => {
  it("trim + minúsculas", () => {
    expect(normalizeEmail("  A@B.com ")).toBe("a@b.com");
  });
});
