// Portado de app-financeiro/src/lib/calculations/balance.js e accounts.js.
// Fórmula fundamental: Saldo = Entradas − Saídas − Investimentos − contas abertas.
import { num } from "../../lib/dates.js";

export function calcBalance(p: { totalIncome: number; totalExpense: number; totalInvestment: number; openBills?: number }): number {
  return p.totalIncome - p.totalExpense - p.totalInvestment - (p.openBills ?? 0);
}

export function calcDailyBudget(available: number, daysRemaining: number): number {
  if (daysRemaining <= 0) return 0;
  return available / daysRemaining;
}

export function calcCurrentDailyRate(totalSpent: number, daysElapsed: number): number {
  if (daysElapsed <= 0) return 0;
  return totalSpent / daysElapsed;
}

export function calcProjectedBalance(current: number, dailyRate: number, daysRemaining: number): number {
  return current - dailyRate * daysRemaining;
}

// ── Saldo por conta (feature 031) ─────────────────────────────────────────
//   saldo(conta, até D) = openingBalance + Σ INCOME − Σ EXPENSE − Σ INVESTMENT
//                         + Σ TRANSFER recebidas − Σ TRANSFER enviadas
//   com openingDate ≤ date ≤ D. Compra em fatura (invoiceId) não movimenta conta.
export type BalanceAccount = { id: string; openingBalance: unknown; openingDate: string | null };
export type BalanceTx = {
  type: "EXPENSE" | "INCOME" | "INVESTMENT" | "TRANSFER";
  date: string;
  amount: unknown;
  accountId: string | null;
  toAccountId: string | null;
  invoiceId: string | null;
};

function inWindow(date: string, openingDate: string | null, upTo: string | null): boolean {
  if (!date) return false;
  if (openingDate && date < openingDate) return false;
  if (upTo && date > upTo) return false;
  return true;
}

export const UNASSIGNED = "__unassigned__";

export function computeAccountBalances(accounts: BalanceAccount[], txs: BalanceTx[], upTo: string | null = null): Map<string, number> {
  const balances = new Map<string, number>();
  const opening = new Map<string, string | null>();
  for (const a of accounts) {
    balances.set(a.id, num(a.openingBalance));
    opening.set(a.id, a.openingDate);
  }
  balances.set(UNASSIGNED, 0);

  const apply = (accountId: string | null, delta: number, date: string) => {
    if (accountId == null) {
      if (inWindow(date, null, upTo)) balances.set(UNASSIGNED, (balances.get(UNASSIGNED) ?? 0) + delta);
      return;
    }
    if (!balances.has(accountId)) return; // conta desconhecida: ignora, não inventa saldo
    if (!inWindow(date, opening.get(accountId) ?? null, upTo)) return;
    balances.set(accountId, (balances.get(accountId) ?? 0) + delta);
  };

  for (const t of txs) {
    const v = num(t.amount);
    switch (t.type) {
      case "INCOME": apply(t.accountId, v, t.date); break;
      case "EXPENSE": if (t.invoiceId == null) apply(t.accountId, -v, t.date); break;
      case "INVESTMENT": apply(t.accountId, -v, t.date); break;
      case "TRANSFER":
        if (t.toAccountId != null) apply(t.toAccountId, v, t.date);
        if (t.accountId != null) apply(t.accountId, -v, t.date);
        break;
    }
  }
  return balances;
}
