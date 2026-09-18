// Portado de weektodo-journal (repeatingEventDateCache + helpers/repeatingEvents.js).
// Expande RRULEs para um intervalo e diz quais regras devem materializar em cada data.
// A garantia de "uma vez por data" mora na tabela RecurrenceInstance (PK ruleId+date).
import { rrulestr } from "rrule";
import { fromISODate, toISODate } from "../../lib/dates.js";

export type RuleLike = { id: string; rrule: string; startDate: string; endDate: string | null; active: boolean };

export function occurrencesBetween(rule: RuleLike, from: string, to: string): string[] {
  if (!rule.active) return [];
  const start = fromISODate(rule.startDate);
  const dtstart = rule.rrule.includes("DTSTART") ? "" : `DTSTART:${start.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z\n`;
  const set = rrulestr(`${dtstart}${rule.rrule.startsWith("RRULE:") ? rule.rrule : `RRULE:${rule.rrule}`}`, { forceset: true });
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
