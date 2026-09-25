import { describe, expect, it } from "vitest";
import { canLeaveCollection, duplicateCopy, migrationCopy, moveKind } from "./moves.js";

const day = { id: "seg", kind: "DAILY" };
const otherDay = { id: "sex", kind: "DAILY" };
const list = { id: "algum-dia", kind: "CUSTOM" };

const entry = (id: string, extra: Record<string, unknown> = {}) => ({
  id, collectionId: "seg", date: "2026-09-21", parentId: null as string | null, kind: "TASK", status: "OPEN", text: id,
  description: null as string | null, time: null as string | null, alarm: false, priority: 0, color: null as string | null,
  tags: [] as string[], position: 0, goalId: null as string | null, mediaItemId: null as string | null,
  recurrenceRuleId: null as string | null, ...extra,
});

describe("moveKind", () => {
  it("mesma coleção reordena", () => {
    expect(moveKind(day, day)).toBe("reorder");
    expect(moveKind(list, list)).toBe("reorder");
  });
  it("sair de um dia migra (deixa rastro), para outro dia ou para uma lista", () => {
    expect(moveKind(day, otherDay)).toBe("migrate");
    expect(moveKind(day, list)).toBe("migrate");
  });
  it("sair de uma lista realoca (sem rastro)", () => {
    expect(moveKind(list, day)).toBe("relocate");
    expect(moveKind(list, { id: "projetos", kind: "CUSTOM" })).toBe("relocate");
  });
});

describe("canLeaveCollection", () => {
  it("só raiz aberta", () => {
    expect(canLeaveCollection(entry("a"))).toBe(true);
    expect(canLeaveCollection(entry("a", { status: "DONE" }))).toBe(false);
    expect(canLeaveCollection(entry("a", { status: "MIGRATED" }))).toBe(false);
    expect(canLeaveCollection(entry("a", { status: "CANCELLED" }))).toBe(false);
    expect(canLeaveCollection(entry("a", { parentId: "mae" }))).toBe(false);
  });
});

describe("migrationCopy", () => {
  const src = entry("ligar", {
    kind: "EVENT", description: "**pauta**", time: "14:00", alarm: true, priority: 2, color: "#1971c2", tags: ["casa"],
    goalId: "g1", mediaItemId: "m1", recurrenceRuleId: "r1",
  });
  const children = [
    entry("feita", { status: "DONE", position: 0, parentId: "ligar" }),
    entry("segunda", { position: 2, parentId: "ligar", time: null }),
    entry("primeira", { position: 1, parentId: "ligar", description: "nota", priority: 1 }),
  ];
  const target = { collectionId: "sex", date: "2026-09-25" };
  const copy = migrationCopy(src, children, target);

  it("leva notas e marcadores, aponta a origem e não leva a regra", () => {
    expect(copy.entry).toEqual({
      kind: "EVENT", text: "ligar", description: "**pauta**", time: "14:00", alarm: true, priority: 2, color: "#1971c2",
      tags: ["casa"], goalId: "g1", mediaItemId: "m1", collectionId: "sex", date: "2026-09-25", migratedFromId: "ligar",
      source: "SYSTEM",
    });
    expect(copy.entry).not.toHaveProperty("recurrenceRuleId");
  });

  it("leva só as subtarefas abertas, na ordem, renumeradas", () => {
    expect(copy.children.map((c) => [c.text, c.position])).toEqual([["primeira", 0], ["segunda", 1]]);
    expect(copy.children[0]).toMatchObject({ collectionId: "sex", date: "2026-09-25", description: "nota", priority: 1, source: "SYSTEM" });
  });

  it("não compartilha o array de tags com a origem", () => {
    expect(copy.entry.tags).not.toBe(src.tags);
  });
});

describe("duplicateCopy", () => {
  it("cópia aberta no mesmo lugar, com todas as subtarefas reabertas, sem regra nem rastro", () => {
    const src = entry("pagar", { status: "DONE", time: "09:00", recurrenceRuleId: "r1" });
    const children = [entry("b", { status: "DONE", position: 1 }), entry("a", { position: 0 })];
    const dup = duplicateCopy(src, children);
    expect(dup.entry).toMatchObject({ text: "pagar", status: "OPEN", time: "09:00", collectionId: "seg", date: "2026-09-21", source: "SYSTEM" });
    expect(dup.entry).not.toHaveProperty("migratedFromId");
    expect(dup.entry).not.toHaveProperty("recurrenceRuleId");
    expect(dup.children.map((c) => [c.text, c.status, c.position])).toEqual([["a", "OPEN", 0], ["b", "OPEN", 1]]);
  });
});
