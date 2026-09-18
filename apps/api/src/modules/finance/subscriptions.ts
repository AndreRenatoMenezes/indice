// Portado de app-financeiro/src/lib/subscriptions.js.
import { clampDay, parts } from "../../lib/dates.js";

export type SubscriptionLike = { cycle: "MONTHLY" | "YEARLY"; amount: unknown; billingDay: number; startDate: string };

export function monthlyEquivalent(s: SubscriptionLike): number {
  const v = Number(s.amount) || 0;
  return s.cycle === "MONTHLY" ? v : v / 12;
}

// Próxima cobrança a partir de `today` (ISO). Mensal: próximo billingDay
// (clampado). Anual: mesmo dia/mês de startDate no próximo ano que não passou.
export function nextRenewal(s: SubscriptionLike, today: string): string {
  const t = parts(today);
  const st = parts(s.startDate);
  const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  if (s.cycle === "YEARLY") {
    const candidate = iso(t.y, st.m, clampDay(t.y, st.m, st.d));
    return candidate < today ? iso(t.y + 1, st.m, clampDay(t.y + 1, st.m, st.d)) : candidate;
  }
  if (today < s.startDate) return s.startDate;
  const bday = s.billingDay || st.d;
  if (t.d <= bday) return iso(t.y, t.m, clampDay(t.y, t.m, bday));
  const nm = t.m === 12 ? 1 : t.m + 1;
  const ny = t.m === 12 ? t.y + 1 : t.y;
  return iso(ny, nm, clampDay(ny, nm, bday));
}
