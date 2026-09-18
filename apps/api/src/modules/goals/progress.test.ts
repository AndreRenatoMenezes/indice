import { describe, expect, it } from "vitest";
import { computeGoalProgress } from "./progress.js";

describe("progresso de meta", () => {
  it("calcula percentual, ritmo, exigido e projeção", () => {
    const r = computeGoalProgress({
      targetValue: 120000,
      contributions: [{ date: "2026-07-01", amount: 1000 }, { date: "2026-08-01", amount: 1000 }, { date: "2026-09-01", amount: 1000 }],
      startDate: "2026-07-01",
      targetDate: "2035-08-05",
      today: "2026-09-18",
    });
    expect(r.currentValue).toBe(3000);
    expect(r.progressPct).toBe(2.5);
    expect(r.daysRemaining).toBe(3243);
    expect(r.paceMonthly).toBeGreaterThan(1000);
    expect(r.requiredMonthly).toBeCloseTo((117000 / 3243) * 30, 0);
    expect(r.projectedDate).not.toBeNull();
  });
  it("meta atingida projeta hoje", () => {
    const r = computeGoalProgress({ targetValue: 10, contributions: [{ date: "2026-01-01", amount: 10 }], startDate: "2026-01-01", targetDate: null, today: "2026-02-01" });
    expect(r.progressPct).toBe(100);
    expect(r.projectedDate).toBe("2026-02-01");
  });
  it("meta sem alvo definido só acumula, sem projeção", () => {
    const r = computeGoalProgress({ targetValue: 0, contributions: [{ date: "2026-09-10", amount: 1500 }], startDate: "2026-09-01", targetDate: "2035-08-05", today: "2026-09-18" });
    expect(r.currentValue).toBe(1500);
    expect(r.progressPct).toBe(0);
    expect(r.requiredMonthly).toBeNull();
    expect(r.projectedDate).toBeNull();
  });
});
