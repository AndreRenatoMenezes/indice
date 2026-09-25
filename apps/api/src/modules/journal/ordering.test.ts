import { describe, expect, it } from "vitest";
import { isManual, reposition, sortEntries } from "./ordering.js";

type E = { id: string; status: string; time: string | null; position: number };
const e = (id: string, position: number, extra: Partial<E> = {}): E => ({ id, status: "OPEN", time: null, position, ...extra });
const ids = (list: E[]) => list.map((x) => x.id);

describe("sortEntries (regra 1B)", () => {
  it("abertas antes de fechadas; com hora antes de sem hora; hora crescente; depois posição", () => {
    const list = [
      e("feita", 0, { status: "DONE" }),
      e("manual-b", 2),
      e("as-10h", 5, { time: "10:00" }),
      e("migrada", 1, { status: "MIGRATED", time: "08:00" }),
      e("manual-a", 1),
      e("as-8h", 9, { time: "08:00" }),
      e("cancelada", 3, { status: "CANCELLED" }),
    ];
    expect(ids(sortEntries(list))).toEqual(["as-8h", "as-10h", "manual-a", "manual-b", "migrada", "feita", "cancelada"]);
  });

  it("não altera a lista recebida", () => {
    const list = [e("b", 1), e("a", 0)];
    sortEntries(list);
    expect(ids(list)).toEqual(["b", "a"]);
  });
});

describe("isManual", () => {
  it("só aberta e sem hora", () => {
    expect(isManual(e("x", 0))).toBe(true);
    expect(isManual(e("x", 0, { time: "09:00" }))).toBe(false);
    expect(isManual(e("x", 0, { status: "DONE" }))).toBe(false);
    expect(isManual(e("x", 0, { status: "MIGRATED" }))).toBe(false);
  });
});

describe("reposition", () => {
  // Na tela: 09:00 · a · b · c · (feita)
  const day = () => [e("h9", 0, { time: "09:00" }), e("a", 1), e("b", 2), e("c", 3), e("feita", 4, { status: "DONE" })];

  it("solta antes de uma manual", () => {
    expect(reposition(day(), "c", "a")).toEqual([
      { id: "c", position: 1 },
      { id: "a", position: 2 },
      { id: "b", position: 3 },
    ]);
  });

  it("antes de uma com hora vai para o fim das manuais", () => {
    expect(reposition(day(), "a", "h9")).toEqual([
      { id: "b", position: 1 },
      { id: "c", position: 2 },
      { id: "a", position: 3 },
    ]);
  });

  it("antes de uma fechada vai para o fim das manuais", () => {
    expect(reposition(day(), "a", "feita")).toEqual(reposition(day(), "a", null));
  });

  it("beforeId nulo, ausente ou desconhecido → fim das manuais", () => {
    const expected = [
      { id: "b", position: 1 },
      { id: "c", position: 2 },
      { id: "a", position: 3 },
    ];
    expect(reposition(day(), "a", null)).toEqual(expected);
    expect(reposition(day(), "a", undefined)).toEqual(expected);
    expect(reposition(day(), "a", "sumiu")).toEqual(expected);
  });

  it("item com hora ou fechado não se move", () => {
    expect(reposition(day(), "h9", "a")).toEqual([]);
    expect(reposition(day(), "feita", "a")).toEqual([]);
    expect(reposition(day(), "nao-existe", "a")).toEqual([]);
  });

  it("só devolve as posições que mudaram", () => {
    expect(reposition(day(), "b", "c")).toEqual([]); // b já está antes de c
    expect(reposition(day(), "a", "c")).toEqual([
      { id: "b", position: 1 },
      { id: "a", position: 2 },
    ]);
  });

  it("recém-chegado (posição alta) entra antes do alvo; lista sem fechadas", () => {
    const list = [e("a", 0), e("b", 1), e("novo", 99)];
    expect(reposition(list, "novo", "b")).toEqual([
      { id: "novo", position: 1 },
      { id: "b", position: 2 },
    ]);
    expect(reposition(list, "novo", null)).toEqual([{ id: "novo", position: 2 }]);
  });

  it("normaliza posições bagunçadas", () => {
    const list = [e("a", 7), e("b", 7), e("c", 12)];
    expect(reposition(list, "c", "a")).toEqual([
      { id: "c", position: 0 },
      { id: "a", position: 1 },
      { id: "b", position: 2 },
    ]);
  });
});
