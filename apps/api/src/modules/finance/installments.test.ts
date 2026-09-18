import { describe, expect, it } from "vitest";
import { installmentGroupId, installmentImportId, projectInstallments } from "./installments.js";

describe("projectInstallments (feature 032)", () => {
  it("projeta as parcelas restantes com o mesmo importId determinístico", () => {
    const r = projectInstallments(
      { date: "2026-01-31", description: "Loja X", amount: 100, installment: { current: 3, total: 5 } },
      { cardId: "c1", refMonth: 2, refYear: 2026 },
    );
    expect(r.parcels.map((p) => p.installmentNo)).toEqual([4, 5]);
    expect(r.parcels.map((p) => `${p.refYear}-${p.refMonth}`)).toEqual(["2026-3", "2026-4"]);
    expect(r.parcels[0]?.date).toBe("2026-02-28"); // dia clampado
    const expected = installmentImportId(installmentGroupId({ cardId: "c1", description: "Loja X", total: 5, amount: 100 }), 4);
    expect(r.parcels[0]?.importId).toBe(expected);
    expect(r.skipped).toBe(0);
  });
  it("respeita o teto de ciclos e reporta o que ficou de fora", () => {
    const r = projectInstallments(
      { date: "2026-01-10", description: "Loja X", amount: 50, installment: { current: 1, total: 12 } },
      { refMonth: 1, refYear: 2026, maxFuture: 3 },
    );
    expect(r.parcels).toHaveLength(3);
    expect(r.skipped).toBe(8);
  });
  it("ignora 1/1 e fora da faixa", () => {
    expect(projectInstallments({ date: "2026-01-10", description: "x", amount: 1, installment: { current: 1, total: 1 } }, { refMonth: 1, refYear: 2026 }).parcels).toEqual([]);
  });
});
