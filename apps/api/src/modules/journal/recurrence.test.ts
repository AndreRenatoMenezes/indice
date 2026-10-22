import { describe, expect, it } from "vitest";
import type { RecurrenceInput } from "@indice/shared";
import { buildRRule, describeRule, occurrencesBetween, plannedOccurrences, ruleEndDate, rulesDueOn, type RuleLike } from "./recurrence.js";

// 2026-09-21 é segunda-feira.
const MON = "2026-09-21";
const opts = (o: Partial<RecurrenceInput> & Pick<RecurrenceInput, "freq">): RecurrenceInput => ({ interval: 1, end: { type: "never" }, ...o });
const rule = (o: RecurrenceInput, startDate = MON, id = "r"): RuleLike => ({
  id, rrule: buildRRule(o, startDate), startDate, endDate: ruleEndDate(o, startDate), active: true,
});
const between = (o: RecurrenceInput, from: string, to: string, startDate = MON) => occurrencesBetween(rule(o, startDate), from, to);

describe("buildRRule + occurrencesBetween", () => {
  it("todo dia e a cada 2 dias", () => {
    expect(buildRRule(opts({ freq: "DAILY" }), MON)).toBe("FREQ=DAILY;INTERVAL=1");
    expect(between(opts({ freq: "DAILY" }), "2026-09-20", "2026-09-23")).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
    expect(between(opts({ freq: "DAILY", interval: 2 }), MON, "2026-09-27")).toEqual(["2026-09-21", "2026-09-23", "2026-09-25", "2026-09-27"]);
  });

  it("semanal sem dias usa o dia da semana do início", () => {
    expect(buildRRule(opts({ freq: "WEEKLY" }), "2026-09-23")).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=WE");
    expect(between(opts({ freq: "WEEKLY" }), MON, "2026-10-11", "2026-09-23")).toEqual(["2026-09-23", "2026-09-30", "2026-10-07"]);
  });

  it("semanal com dias escolhidos e intervalo", () => {
    const o = opts({ freq: "WEEKLY", weekdays: [5, 1, 3, 1] });
    expect(buildRRule(o, MON)).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR");
    expect(between(o, MON, "2026-09-27")).toEqual(["2026-09-21", "2026-09-23", "2026-09-25"]);
    expect(between(opts({ freq: "WEEKLY", interval: 2, weekdays: [1] }), MON, "2026-10-19")).toEqual(["2026-09-21", "2026-10-05", "2026-10-19"]);
  });

  it("dias úteis", () => {
    expect(buildRRule(opts({ freq: "WEEKDAYS" }), MON)).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR");
    expect(between(opts({ freq: "WEEKDAYS" }), "2026-09-25", "2026-09-29")).toEqual(["2026-09-25", "2026-09-28", "2026-09-29"]);
  });

  it("mensal: dia do início, dias escolhidos, intervalo e dia 31 pulado em meses curtos", () => {
    expect(between(opts({ freq: "MONTHLY" }), MON, "2026-11-30", "2026-09-15")).toEqual(["2026-10-15", "2026-11-15"]);
    expect(between(opts({ freq: "MONTHLY", monthDays: [15, 1] }), "2026-09-01", "2026-10-31", "2026-09-01")).toEqual([
      "2026-09-01", "2026-09-15", "2026-10-01", "2026-10-15",
    ]);
    expect(between(opts({ freq: "MONTHLY", interval: 2, monthDays: [10] }), "2026-09-01", "2027-01-31", "2026-09-10")).toEqual([
      "2026-09-10", "2026-11-10", "2027-01-10",
    ]);
    expect(between(opts({ freq: "MONTHLY", monthDays: [31] }), "2027-01-01", "2027-05-31", "2027-01-31")).toEqual([
      "2027-01-31", "2027-03-31", "2027-05-31",
    ]);
  });

  it("anual e a cada 2 anos", () => {
    expect(buildRRule(opts({ freq: "YEARLY" }), "2026-12-25")).toBe("FREQ=YEARLY;INTERVAL=1");
    expect(between(opts({ freq: "YEARLY" }), "2026-01-01", "2028-12-31", "2026-12-25")).toEqual(["2026-12-25", "2027-12-25", "2028-12-25"]);
    expect(between(opts({ freq: "YEARLY", interval: 2 }), "2026-01-01", "2030-12-31", "2026-12-25")).toEqual(["2026-12-25", "2028-12-25", "2030-12-25"]);
  });
});

describe("fim da repetição", () => {
  it("COUNT limita as ocorrências e ruleEndDate é a última", () => {
    const o = opts({ freq: "WEEKLY", end: { type: "count", count: 3 } });
    expect(buildRRule(o, MON)).toBe("FREQ=WEEKLY;INTERVAL=1;BYDAY=MO;COUNT=3");
    expect(ruleEndDate(o, MON)).toBe("2026-10-05");
    expect(between(o, MON, "2026-12-31")).toEqual(["2026-09-21", "2026-09-28", "2026-10-05"]);
  });

  it("UNTIL inclui o próprio dia e ruleEndDate é a data", () => {
    const o = opts({ freq: "DAILY", end: { type: "until", date: "2026-09-23" } });
    expect(buildRRule(o, MON)).toBe("FREQ=DAILY;INTERVAL=1;UNTIL=20260923T235959Z");
    expect(ruleEndDate(o, MON)).toBe("2026-09-23");
    expect(between(o, MON, "2026-12-31")).toEqual(["2026-09-21", "2026-09-22", "2026-09-23"]);
  });

  it("sem fim: ruleEndDate nulo", () => {
    expect(ruleEndDate(opts({ freq: "DAILY" }), MON)).toBeNull();
  });

  it("COUNT com dia 31 conta só os meses que têm 31", () => {
    const o = opts({ freq: "MONTHLY", monthDays: [31], end: { type: "count", count: 2 } });
    expect(ruleEndDate(o, "2027-01-31")).toBe("2027-03-31");
  });

  it("regra inativa não gera nada", () => {
    expect(occurrencesBetween({ ...rule(opts({ freq: "DAILY" })), active: false }, MON, "2026-09-30")).toEqual([]);
  });
});

describe("describeRule", () => {
  it("textos em pt-BR", () => {
    expect(describeRule(opts({ freq: "DAILY" }), MON)).toBe("todo dia");
    expect(describeRule(opts({ freq: "DAILY", interval: 2 }), MON)).toBe("a cada 2 dias");
    expect(describeRule(opts({ freq: "WEEKLY" }), MON)).toBe("toda segunda");
    expect(describeRule(opts({ freq: "WEEKLY" }), "2026-09-26")).toBe("todo sábado");
    expect(describeRule(opts({ freq: "WEEKLY", weekdays: [1, 3, 5] }), MON)).toBe("seg, qua e sex");
    expect(describeRule(opts({ freq: "WEEKLY", interval: 2 }), MON)).toBe("a cada 2 semanas: segunda");
    expect(describeRule(opts({ freq: "WEEKLY", interval: 3, weekdays: [2, 4] }), MON)).toBe("a cada 3 semanas: ter e qui");
    expect(describeRule(opts({ freq: "WEEKDAYS" }), MON)).toBe("dias úteis");
    expect(describeRule(opts({ freq: "MONTHLY" }), "2026-09-15")).toBe("todo dia 15");
    expect(describeRule(opts({ freq: "MONTHLY", monthDays: [15, 1] }), MON)).toBe("dias 1 e 15 de cada mês");
    expect(describeRule(opts({ freq: "MONTHLY", interval: 2, monthDays: [10] }), MON)).toBe("dia 10, a cada 2 meses");
    expect(describeRule(opts({ freq: "YEARLY" }), "2026-12-25")).toBe("todo ano em 25/12");
    expect(describeRule(opts({ freq: "YEARLY", interval: 2 }), "2026-12-25")).toBe("a cada 2 anos em 25/12");
  });

  it("sufixos de fim", () => {
    expect(describeRule(opts({ freq: "WEEKLY", end: { type: "until", date: "2026-12-31" } }), MON)).toBe("toda segunda · até 31/12/2026");
    expect(describeRule(opts({ freq: "DAILY", end: { type: "count", count: 10 } }), MON)).toBe("todo dia · 10 vezes");
    expect(describeRule(opts({ freq: "DAILY", end: { type: "count", count: 1 } }), MON)).toBe("todo dia · 1 vez");
  });
});

describe("plannedOccurrences", () => {
  const weekly = rule(opts({ freq: "WEEKLY" }), MON, "seg");
  const daily = rule(opts({ freq: "DAILY" }), "2026-09-26", "dia");

  it("pula os pares que já existem", () => {
    const existing = new Set(["seg|2026-09-28", "dia|2026-09-27"]);
    expect(plannedOccurrences([weekly, daily], existing, "2026-09-26", "2026-10-06")).toEqual([
      { ruleId: "seg", date: "2026-10-05" },
      ...["2026-09-26", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]
        .map((date) => ({ ruleId: "dia", date })),
    ]);
  });

  it("nada antes de from nem de intervalo invertido", () => {
    expect(plannedOccurrences([weekly], new Set(), "2026-09-22", "2026-09-27")).toEqual([]);
    expect(plannedOccurrences([weekly], new Set(), "2026-10-01", "2026-09-01")).toEqual([]);
  });

  it("rulesDueOn segue funcionando", () => {
    expect(rulesDueOn([weekly, daily], "2026-09-28").map((r) => r.id)).toEqual(["seg", "dia"]);
    expect(rulesDueOn([weekly, daily], "2026-09-22").map((r) => r.id)).toEqual([]);
  });
});
