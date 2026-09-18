// Portado de app-financeiro/src/lib/installments.js (feature 032, contrato C3).
//   installmentGroupId = FNV-1a(cardId | descrição normalizada | total | valor da parcela)
//   importId           = "parc:<groupId>:<n>"
// A parcela projetada hoje e a lida na fatura do mês que vem geram o MESMO
// importId, então caem na dedup exata sem código extra.
import { clampDay } from "../../lib/dates.js";
import { hashString, normalizeDescription } from "./import-id.js";

export const MIN_INSTALLMENT_TOTAL = 2;
export const MAX_INSTALLMENT_TOTAL = 36;

export type Installment = { current: number; total: number };

export function isInstallmentPlan(i: Installment | null | undefined): i is Installment {
  if (!i) return false;
  if (!Number.isInteger(i.current) || !Number.isInteger(i.total)) return false;
  if (i.total < MIN_INSTALLMENT_TOTAL || i.total > MAX_INSTALLMENT_TOTAL) return false;
  return i.current >= 1 && i.current <= i.total;
}

export function installmentGroupId(p: { cardId: string | null; description: string; total: number; amount: number }): string {
  return hashString([p.cardId ?? "", normalizeDescription(p.description), p.total, p.amount.toFixed(2)].join("|"));
}

export function installmentImportId(groupId: string, n: number): string {
  return `parc:${groupId}:${n}`;
}

function shiftMonth(month1: number, year: number, offset: number): { month: number; year: number } {
  const abs = year * 12 + (month1 - 1) + offset;
  return { month: (((abs % 12) + 12) % 12) + 1, year: Math.floor(abs / 12) };
}

function shiftDate(iso: string, offset: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const t = shiftMonth(m, y, offset);
  const day = clampDay(t.year, t.month, d);
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type ProjectedParcel = {
  installmentGroupId: string; installmentNo: number; installmentTotal: number; importId: string;
  description: string; amount: number; date: string; refMonth: number; refYear: number; monthOffset: number;
};

export function projectInstallments(
  line: { date: string; description: string; amount: number; installment: Installment | null },
  opts: { cardId?: string | null; refMonth: number; refYear: number; maxFuture?: number },
): { groupId: string | null; parcels: ProjectedParcel[]; skipped: number } {
  if (!isInstallmentPlan(line.installment)) return { groupId: null, parcels: [], skipped: 0 };
  const { current, total } = line.installment;
  const groupId = installmentGroupId({ cardId: opts.cardId ?? null, description: line.description, total, amount: line.amount });
  const remaining = total - current;
  const fit = Math.max(0, Math.min(remaining, opts.maxFuture ?? Infinity));
  const parcels: ProjectedParcel[] = [];
  for (let i = 1; i <= fit; i++) {
    const no = current + i;
    const target = shiftMonth(opts.refMonth, opts.refYear, i);
    parcels.push({
      installmentGroupId: groupId, installmentNo: no, installmentTotal: total, importId: installmentImportId(groupId, no),
      description: line.description, amount: line.amount, date: shiftDate(line.date, i),
      refMonth: target.month, refYear: target.year, monthOffset: i,
    });
  }
  return { groupId, parcels, skipped: remaining - fit };
}
