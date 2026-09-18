import { describe, expect, it } from "vitest";
import { effectiveInvoiceStatus, resolveCycle } from "./invoice-cycle.js";

describe("resolveCycle (feature 020)", () => {
  const bank = { closingDay: 25, dueDay: 5 };

  it("compra antes do fechamento cai na fatura que fecha no mês", () => {
    expect(resolveCycle("2026-03-10", bank)).toEqual({ closingDate: "2026-03-25", dueDate: "2026-04-05", refMonth: 4, refYear: 2026 });
  });
  it("compra após o fechamento cai na fatura seguinte", () => {
    expect(resolveCycle("2026-03-26", bank)).toEqual({ closingDate: "2026-04-25", dueDate: "2026-05-05", refMonth: 5, refYear: 2026 });
  });
  it("compra no dia do fechamento ainda conta", () => {
    expect(resolveCycle("2026-03-25", bank)?.refMonth).toBe(4);
  });
  it("vencimento > fechamento vence no mesmo mês", () => {
    expect(resolveCycle("2026-03-01", { closingDay: 3, dueDay: 10 })).toEqual({ closingDate: "2026-03-03", dueDate: "2026-03-10", refMonth: 3, refYear: 2026 });
  });
  it("clampa fechamento 31 em fevereiro e vira o ano", () => {
    expect(resolveCycle("2026-12-30", { closingDay: 31, dueDay: 10 })).toEqual({ closingDate: "2026-12-31", dueDate: "2027-01-10", refMonth: 1, refYear: 2027 });
    expect(resolveCycle("2026-02-27", { closingDay: 31, dueDay: 10 })?.closingDate).toBe("2026-02-28");
  });
  it("instituição sem ciclo devolve null", () => {
    expect(resolveCycle("2026-03-10", { closingDay: null, dueDay: null })).toBeNull();
  });
});

describe("effectiveInvoiceStatus", () => {
  it("fecha no dia seguinte ao closingDate", () => {
    expect(effectiveInvoiceStatus({ status: "OPEN", closingDate: "2026-03-25" }, "2026-03-25")).toBe("OPEN");
    expect(effectiveInvoiceStatus({ status: "OPEN", closingDate: "2026-03-25" }, "2026-03-26")).toBe("CLOSED");
  });
  it("PAID nunca é derivado", () => {
    expect(effectiveInvoiceStatus({ status: "PAID", closingDate: "2026-03-25" }, "2026-01-01")).toBe("PAID");
  });
});
