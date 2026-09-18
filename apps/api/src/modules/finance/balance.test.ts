import { describe, expect, it } from "vitest";
import { calcBalance, calcDailyBudget, computeAccountBalances, UNASSIGNED } from "./balance.js";

describe("saldo do mês", () => {
  it("Saldo = Entradas − Saídas − Investimentos − contas abertas", () => {
    expect(calcBalance({ totalIncome: 5000, totalExpense: 2000, totalInvestment: 500, openBills: 300 })).toBe(2200);
    expect(calcDailyBudget(2200, 11)).toBe(200);
    expect(calcDailyBudget(2200, 0)).toBe(0);
  });
});

describe("saldo por conta (feature 031)", () => {
  const accounts = [{ id: "a", openingBalance: 100, openingDate: "2026-01-01" }, { id: "b", openingBalance: 0, openingDate: "2026-02-01" }];
  it("aplica janela de abertura, ignora compra em fatura e move transferências", () => {
    const txs = [
      { type: "INCOME" as const, date: "2026-01-05", amount: 50, accountId: "a", toAccountId: null, invoiceId: null },
      { type: "EXPENSE" as const, date: "2026-01-06", amount: 30, accountId: "a", toAccountId: null, invoiceId: "inv" }, // não movimenta
      { type: "EXPENSE" as const, date: "2025-12-31", amount: 999, accountId: "a", toAccountId: null, invoiceId: null }, // antes da abertura
      { type: "TRANSFER" as const, date: "2026-02-10", amount: 20, accountId: "a", toAccountId: "b", invoiceId: null },
      { type: "EXPENSE" as const, date: "2026-02-11", amount: 7, accountId: null, toAccountId: null, invoiceId: null },
    ];
    const b = computeAccountBalances(accounts, txs);
    expect(b.get("a")).toBe(130);
    expect(b.get("b")).toBe(20);
    expect(b.get(UNASSIGNED)).toBe(-7);
  });
  it("respeita upTo", () => {
    const txs = [{ type: "INCOME" as const, date: "2026-03-01", amount: 50, accountId: "a", toAccountId: null, invoiceId: null }];
    expect(computeAccountBalances(accounts, txs, "2026-02-28").get("a")).toBe(100);
  });
});
