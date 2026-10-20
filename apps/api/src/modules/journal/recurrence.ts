// Portado de weektodo-journal (repeatingEventDateCache + helpers/repeatingEvents.js).
// Expande RRULEs para um intervalo e diz quais regras devem materializar em cada data.
// A garantia de "uma vez por data" mora na tabela RecurrenceInstance (PK ruleId+date).
import * as rruleModule from "rrule";
import type { RecurrenceInput } from "@indice/shared";
import { fromISODate, isoWeekday, parts, toISODate } from "../../lib/dates.js";

// O `rrule` publica um bundle CommonJS (UMD) sem `exports`: no Node em ESM os
// nomes só vêm pelo `default`; o vitest faz a interop sozinho.
const { rrulestr } = (rruleModule as unknown as { default?: typeof rruleModule }).default ?? rruleModule;

export type RuleLike = { id: string; rrule: string; startDate: string; endDate: string | null; active: boolean };

function expand(rrule: string, startDate: string) {
  const start = fromISODate(startDate);
  const dtstart = rrule.includes("DTSTART") ? "" : `DTSTART:${start.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z\n`;
  return rrulestr(`${dtstart}${rrule.startsWith("RRULE:") ? rrule : `RRULE:${rrule}`}`, { forceset: true });
}

export function occurrencesBetween(rule: RuleLike, from: string, to: string): string[] {
  if (!rule.active) return [];
  const set = expand(rule.rrule, rule.startDate);
  const lo = fromISODate(from);
  const hi = fromISODate(to);
  hi.setUTCHours(23, 59, 59, 999);
  const end = rule.endDate ? fromISODate(rule.endDate) : null;
  return set
    .between(lo, hi, true)
    .filter((d) => !end || d <= end)
    .map(toISODate);
}

export function rulesDueOn(rules: RuleLike[], date: string): RuleLike[] {
  return rules.filter((r) => occurrencesBetween(r, date, date).length > 0);
}

// ── Montar e descrever regras a partir das opções do WeekToDo ──────────────

const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const; // índice = dia ISO - 1
const SHORT = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"] as const;
const LONG = ["toda segunda", "toda terça", "toda quarta", "toda quinta", "toda sexta", "todo sábado", "todo domingo"] as const;
const LONG_BARE = ["segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"] as const;

const uniqSorted = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);
const weekdaysOf = (o: RecurrenceInput, startDate: string) => (o.weekdays?.length ? uniqSorted(o.weekdays) : [isoWeekday(startDate)]);
const monthDaysOf = (o: RecurrenceInput, startDate: string) => (o.monthDays?.length ? uniqSorted(o.monthDays) : [parts(startDate).d]);

// RRULE sem DTSTART (o início mora em `startDate`). "Dias úteis" = semanal de seg a sex.
export function buildRRule(o: RecurrenceInput, startDate: string): string {
  const rule = [`FREQ=${o.freq === "WEEKDAYS" ? "WEEKLY" : o.freq}`, `INTERVAL=${o.interval}`];
  if (o.freq === "WEEKLY") rule.push(`BYDAY=${weekdaysOf(o, startDate).map((d) => BYDAY[d - 1]).join(",")}`);
  if (o.freq === "WEEKDAYS") rule.push("BYDAY=MO,TU,WE,TH,FR");
  if (o.freq === "MONTHLY") rule.push(`BYMONTHDAY=${monthDaysOf(o, startDate).join(",")}`);
  if (o.end.type === "count") rule.push(`COUNT=${o.end.count}`);
  if (o.end.type === "until") rule.push(`UNTIL=${o.end.date.replace(/-/g, "")}T235959Z`);
  return rule.join(";");
}

// Último dia em que a regra pode gerar ocorrência: a data do "até", a última
// das N vezes, ou nenhum (repete para sempre).
export function ruleEndDate(o: RecurrenceInput, startDate: string): string | null {
  if (o.end.type === "never") return null;
  if (o.end.type === "until") return o.end.date;
  const all = expand(buildRRule(o, startDate), startDate).all();
  return all.length ? toISODate(all[all.length - 1]!) : startDate;
}

function joinPt(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`;
}

const ddmm = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
const ddmmyyyy = (s: string) => `${ddmm(s)}/${s.slice(0, 4)}`;

// Texto curto em pt-BR para a lateral e o painel ("toda segunda · até 31/12/2026").
export function describeRule(o: RecurrenceInput, startDate: string): string {
  const n = o.interval;
  let base: string;
  switch (o.freq) {
    case "DAILY":
      base = n === 1 ? "todo dia" : `a cada ${n} dias`;
      break;
    case "WEEKDAYS":
      base = n === 1 ? "dias úteis" : `dias úteis, a cada ${n} semanas`;
      break;
    case "WEEKLY": {
      const days = weekdaysOf(o, startDate);
      if (n === 1) base = days.length === 1 ? LONG[days[0]! - 1]! : joinPt(days.map((d) => SHORT[d - 1]!));
      else base = `a cada ${n} semanas: ${days.length === 1 ? LONG_BARE[days[0]! - 1] : joinPt(days.map((d) => SHORT[d - 1]!))}`;
      break;
    }
    case "MONTHLY": {
      const days = monthDaysOf(o, startDate).map(String);
      if (n === 1) base = days.length === 1 ? `todo dia ${days[0]}` : `dias ${joinPt(days)} de cada mês`;
      else base = `${days.length === 1 ? "dia" : "dias"} ${joinPt(days)}, a cada ${n} meses`;
      break;
    }
    case "YEARLY":
      base = n === 1 ? `todo ano em ${ddmm(startDate)}` : `a cada ${n} anos em ${ddmm(startDate)}`;
      break;
  }
  if (o.end.type === "count") return `${base} · ${o.end.count} ${o.end.count === 1 ? "vez" : "vezes"}`;
  if (o.end.type === "until") return `${base} · até ${ddmmyyyy(o.end.date)}`;
  return base;
}

// O que falta materializar no intervalo: ocorrências das regras que ainda não
// têm instância ("ruleId|date" em `existing`). Nada antes de `from`.
export function plannedOccurrences(rules: RuleLike[], existing: Set<string>, from: string, to: string): { ruleId: string; date: string }[] {
  if (from > to) return [];
  return rules.flatMap((r) =>
    occurrencesBetween(r, from, to)
      .filter((date) => date >= from && !existing.has(`${r.id}|${date}`))
      .map((date) => ({ ruleId: r.id, date })),
  );
}
