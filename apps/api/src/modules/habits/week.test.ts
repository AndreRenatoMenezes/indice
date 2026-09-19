import { describe, expect, it } from "vitest";
import { consistency, weekOf, weekStates } from "./week.js";

const every = { weekdays: [1, 2, 3, 4, 5, 6, 7], startDate: "2026-08-01" };
const weekdaysOnly = { weekdays: [1, 2, 3, 4, 5], startDate: "2026-09-01" };
const doneOn = (dates: string[]) => (d: string) => dates.includes(d);

describe("weekOf", () => {
  it("vai de segunda a domingo da semana da data", () => {
    // 2026-09-18 é sexta-feira
    expect(weekOf("2026-09-18")).toEqual(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]);
    expect(weekOf("2026-09-14")[0]).toBe("2026-09-14");
    expect(weekOf("2026-09-20")[6]).toBe("2026-09-20");
  });
});

describe("weekStates", () => {
  it("classifica feito, perdido, hoje, fora da escala e futuro", () => {
    const states = weekStates(weekdaysOnly, "2026-09-18", doneOn(["2026-09-14", "2026-09-16"]));
    expect(states.map((s) => s.status)).toEqual(["done", "miss", "done", "miss", "today", "off", "off"]);
  });
  it("um dia futuro é future mesmo se escalado; um dia feito fora da escala conta como done", () => {
    const states = weekStates(every, "2026-09-16", doneOn(["2026-09-19"]));
    expect(states[3]!.status).toBe("future");
    expect(states[5]!.status).toBe("done");
  });
  it("dias antes de startDate são off", () => {
    const late = { weekdays: [1, 2, 3, 4, 5, 6, 7], startDate: "2026-09-17" };
    expect(weekStates(late, "2026-09-18", () => false).map((s) => s.status)).toEqual(["off", "off", "off", "miss", "today", "future", "future"]);
  });
});

describe("consistency", () => {
  it("é a fração de dias escalados com log done, em %", () => {
    // 30 dias terminando em 18/09: 20/08..18/09; todos escalados; 15 feitos → 50%
    const done = Array.from({ length: 15 }, (_, i) => `2026-09-${String(4 + i).padStart(2, "0")}`);
    expect(consistency(every, "2026-09-18", doneOn(done))).toBe(50);
  });
  it("ignora dias fora da escala e antes do início", () => {
    const h = { weekdays: [1, 2, 3, 4, 5], startDate: "2026-09-14" };
    // escalados: 14,15,16,17,18 → 5; feitos 14,15,16 → 60%
    expect(consistency(h, "2026-09-18", doneOn(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-13"]))).toBe(60);
  });
  it("sem dias escalados devolve 0", () => {
    expect(consistency({ weekdays: [7], startDate: "2030-01-01" }, "2026-09-18", () => true)).toBe(0);
  });
});
