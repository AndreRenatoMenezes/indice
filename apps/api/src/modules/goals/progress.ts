// Progresso, ritmo e projeção de uma meta de longo prazo. Funções puras;
// alimentam GoalSnapshot e o export para modelagem.
import { addDays, daysBetween } from "../../lib/dates.js";

export type Contribution = { date: string; amount: number };

export type GoalProgress = {
  currentValue: number;
  progressPct: number;
  daysRemaining: number | null;
  paceMonthly: number | null;      // média dos últimos `paceWindowDays`
  requiredMonthly: number | null;  // para bater targetDate
  projectedDate: string | null;    // no ritmo atual
};

export function computeGoalProgress(p: {
  targetValue: number;
  contributions: Contribution[];
  startDate: string;
  targetDate: string | null;
  today: string;
  baseline?: number;               // ex.: saldo de conta vinculada
  paceWindowDays?: number;
}): GoalProgress {
  const window = p.paceWindowDays ?? 90;
  const contributed = p.contributions.reduce((s, c) => s + c.amount, 0);
  const currentValue = (p.baseline ?? 0) + contributed;
  const progressPct = p.targetValue > 0 ? Math.min(100, Math.max(0, (currentValue / p.targetValue) * 100)) : 0;
  const remaining = Math.max(0, p.targetValue - currentValue);

  const windowStart = addDays(p.today, -window);
  const effectiveStart = windowStart > p.startDate ? windowStart : p.startDate;
  const elapsed = Math.max(1, daysBetween(effectiveStart, p.today));
  const inWindow = p.contributions.filter((c) => c.date >= effectiveStart && c.date <= p.today).reduce((s, c) => s + c.amount, 0);
  const paceMonthly = p.contributions.length ? (inWindow / elapsed) * 30 : null;

  const daysRemaining = p.targetDate ? daysBetween(p.today, p.targetDate) : null;
  // Meta sem alvo definido (targetValue 0) não tem exigido nem projeção: só acumula.
  const hasTarget = p.targetValue > 0;
  const requiredMonthly = !hasTarget ? null : daysRemaining != null && daysRemaining > 0 ? (remaining / daysRemaining) * 30 : (daysRemaining != null ? remaining : null);

  let projectedDate: string | null = null;
  if (!hasTarget) projectedDate = null;
  else if (remaining === 0) projectedDate = p.today;
  else if (paceMonthly && paceMonthly > 0) projectedDate = addDays(p.today, Math.ceil((remaining / paceMonthly) * 30));

  return {
    currentValue: round2(currentValue),
    progressPct: round2(progressPct),
    daysRemaining,
    paceMonthly: paceMonthly == null ? null : round2(paceMonthly),
    requiredMonthly: requiredMonthly == null ? null : round2(requiredMonthly),
    projectedDate,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
