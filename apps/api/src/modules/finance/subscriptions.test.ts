import { describe, expect, it } from "vitest";
import { monthlyEquivalent, nextRenewal } from "./subscriptions.js";

describe("assinaturas", () => {
  it("mensal: próximo billingDay com clamp e virada de ano", () => {
    const s = { cycle: "MONTHLY" as const, amount: 30, billingDay: 31, startDate: "2025-01-31" };
    expect(nextRenewal(s, "2026-02-10")).toBe("2026-02-28");
    expect(nextRenewal(s, "2026-12-31")).toBe("2026-12-31");
    expect(nextRenewal({ ...s, billingDay: 5 }, "2026-12-06")).toBe("2027-01-05");
  });
  it("anual: mesmo dia/mês no próximo ano que não passou", () => {
    const s = { cycle: "YEARLY" as const, amount: 120, billingDay: 1, startDate: "2024-05-20" };
    expect(nextRenewal(s, "2026-05-19")).toBe("2026-05-20");
    expect(nextRenewal(s, "2026-05-21")).toBe("2027-05-20");
    expect(monthlyEquivalent(s)).toBe(10);
  });
});
