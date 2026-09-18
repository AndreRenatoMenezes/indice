// Portado de app-financeiro/src/lib/invoiceCycle.js (feature 020/022).
// Dado o ciclo da INSTITUIÇÃO (dia de fechamento F + dia de vencimento V) e a
// data da compra, resolve a qual fatura a compra pertence. Meses aqui são 1..12.
import { clampDay, parts } from "../../lib/dates.js";

export type CycleInstitution = { closingDay: number | null; dueDay: number | null };
export type ResolvedCycle = { closingDate: string; dueDate: string; refMonth: number; refYear: number };

function iso(y: number, m1: number, d: number): string {
  return `${y}-${String(m1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function resolveCycle(purchaseDate: string, inst: CycleInstitution | null | undefined): ResolvedCycle | null {
  if (!inst || inst.closingDay == null || inst.dueDay == null) return null;
  const F = inst.closingDay;
  const V = inst.dueDay;
  const { y, m, d } = parts(purchaseDate);

  // Regras 1 e 2: em qual mês a fatura FECHA (fechamento clampado, regra 5).
  let closeY = y, closeM = m;
  if (d > clampDay(y, m, F)) {
    closeM += 1;
    if (closeM > 12) { closeM = 1; closeY += 1; }
  }
  const closeD = clampDay(closeY, closeM, F);

  // Regra 3: vence em V do mês seguinte se V <= F; senão em V do próprio mês.
  let dueY = closeY, dueM = closeM;
  if (V <= F) {
    dueM += 1;
    if (dueM > 12) { dueM = 1; dueY += 1; }
  }
  const dueD = clampDay(dueY, dueM, V);

  // Regra 4: referência da fatura = mês do vencimento.
  return { closingDate: iso(closeY, closeM, closeD), dueDate: iso(dueY, dueM, dueD), refMonth: dueM, refYear: dueY };
}

// A fatura fecha no dia SEGUINTE ao closingDate (compras do próprio dia contam).
// PAID nunca é derivado: só pagamento explícito grava, só estorno reverte.
export function effectiveInvoiceStatus(inv: { status: string; closingDate: string } | null, todayISO: string): "OPEN" | "CLOSED" | "PAID" {
  if (!inv) return "OPEN";
  if (inv.status === "PAID") return "PAID";
  return todayISO > inv.closingDate ? "CLOSED" : "OPEN";
}
