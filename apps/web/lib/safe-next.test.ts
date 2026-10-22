import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("mantém caminho interno, com query e hash", () => {
    expect(safeNext("/semana")).toBe("/semana");
    expect(safeNext("/midia?status=DONE#top")).toBe("/midia?status=DONE#top");
  });

  it("cai em / para destino vazio ou externo", () => {
    expect(safeNext("")).toBe("/");
    expect(safeNext("   ")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext("http://evil.com/indice")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });

  it("cai em / para protocol-relative", () => {
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("///evil.com")).toBe("/");
  });

  it("cai em / para barra invertida, inclusive %5C", () => {
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("\\\\evil.com")).toBe("/");
    expect(safeNext("/%5Cevil.com")).toBe("/");
    expect(safeNext("/%5cevil.com")).toBe("/");
  });

  it("cai em / quando a normalização gera //", () => {
    expect(safeNext("/..//evil.com")).toBe("/");
    expect(safeNext("/a/..//evil.com")).toBe("/");
  });

  it("cai em / para tab ou newline que mudam a origem", () => {
    expect(safeNext("/\t/evil.com")).toBe("/");
    expect(safeNext("/\n/evil.com")).toBe("/");
  });

  it("não volta para a tela de entrada", () => {
    expect(safeNext("/entrar")).toBe("/");
    expect(safeNext("/entrar?erro=1")).toBe("/");
    expect(safeNext("/entrar/acesso-removido")).toBe("/");
  });
});
