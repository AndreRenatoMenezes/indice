// Datas de calendário como strings "YYYY-MM-DD". O banco guarda `@db.Date`,
// o Prisma devolve Date em UTC 00:00; aqui convertemos sem passar por fuso.

export type ISODate = string;

export function toISODate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function fromISODate(s: ISODate): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function todayISO(timeZone = "America/Sao_Paulo", now = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = fromISODate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISODate(d);
}

export function parts(s: ISODate): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

// 1 = segunda … 7 = domingo (ISO 8601)
export function isoWeekday(s: ISODate): number {
  const js = fromISODate(s).getUTCDay(); // 0 = domingo
  return js === 0 ? 7 : js;
}

export function lastDayOfMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function clampDay(year: number, month1: number, day: number): number {
  return Math.min(day, lastDayOfMonth(year, month1));
}

export function monthRange(year: number, month1: number): { start: ISODate; end: ISODate } {
  const mm = String(month1).padStart(2, "0");
  return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${String(lastDayOfMonth(year, month1)).padStart(2, "0")}` };
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
