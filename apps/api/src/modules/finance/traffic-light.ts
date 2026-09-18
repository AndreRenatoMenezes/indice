// Portado de app-financeiro/src/lib/calculations/trafficLight.js.
// 'green' (Tranquilo) razão >= 1.2 · 'yellow' (No ritmo) 0.9 <= razão < 1.2 · 'red' (Freia).
export type TrafficLight = { status: "green" | "yellow" | "red"; label: string; message: string };

export function calcTrafficLight(suggestedDaily: number, historicalDailyAvg: number, available: number): TrafficLight {
  if (available < 0) {
    return { status: "red", label: "Freia", message: `Saldo negativo de R$ ${Math.abs(available).toFixed(0)}` };
  }
  if (!historicalDailyAvg) {
    return { status: "yellow", label: "No ritmo", message: "Sem histórico para comparar" };
  }
  const ratio = suggestedDaily / historicalDailyAvg;
  if (ratio >= 1.2) {
    return { status: "green", label: "Tranquilo", message: `Sua média diária é R$ ${historicalDailyAvg.toFixed(0)} — há folga` };
  }
  if (ratio >= 0.9) {
    return { status: "yellow", label: "No ritmo", message: "Mantenha o ritmo para fechar no azul" };
  }
  const projected = (suggestedDaily - historicalDailyAvg) * 30;
  return { status: "red", label: "Freia", message: `Ritmo atual te leva a fechar negativo em R$ ${Math.abs(projected).toFixed(0)}` };
}

// Portado de projections.js: dias até o próximo recebimento.
export function daysToNextSalary(dayOfMonth: number, today: string): { days: number; date: string } {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const iso = (yy: number, mm: number, dd: number) => `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const clamp = (yy: number, mm: number) => Math.min(dayOfMonth, new Date(Date.UTC(yy, mm, 0)).getUTCDate());
  let target: string;
  if (d < clamp(y, m)) target = iso(y, m, clamp(y, m));
  else {
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    target = iso(ny, nm, clamp(ny, nm));
  }
  const days = Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  return { days, date: target };
}
