// Datas de calendário como "YYYY-MM-DD", sem passar por fuso — mesma convenção
// de `apps/api/src/lib/dates.ts`. Aqui só o que as páginas precisam para montar
// a semana e escrever o cabeçalho; a aritmética de negócio mora na API.
export type ISODate = string;

const at = (s: ISODate) => new Date(`${s}T00:00:00.000Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(s: ISODate, n: number): ISODate {
  const d = at(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** 1 = segunda … 7 = domingo (ISO 8601). */
export function isoWeekday(s: ISODate): number {
  const js = at(s).getUTCDay();
  return js === 0 ? 7 : js;
}

/** Segunda a domingo da semana que contém `s`. */
export function weekOf(s: ISODate): ISODate[] {
  const monday = addDays(s, 1 - isoWeekday(s));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Número da semana ISO: a que contém a quinta-feira. */
export function isoWeek(s: ISODate): number {
  const thursday = at(addDays(s, 4 - isoWeekday(s)));
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
}

/** Primeiro dia do mês de `s`. */
export const firstOfMonth = (s: ISODate): ISODate => `${s.slice(0, 8)}01`;

/** Mesmo dia `n` meses depois (ou antes), limitado ao último dia do mês. */
export function addMonths(s: ISODate, n: number): ISODate {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return iso(target);
}

/** Semanas (segunda a domingo) que cobrem o mês de `s`, com os dias de borda dos meses vizinhos. */
export function monthGrid(s: ISODate): ISODate[][] {
  const first = firstOfMonth(s);
  const nextMonth = firstOfMonth(addMonths(first, 1));
  const weeks: ISODate[][] = [];
  for (let monday = weekOf(first)[0]!; monday < nextMonth; monday = addDays(monday, 7)) weeks.push(weekOf(monday));
  return weeks;
}

export const year = (s: ISODate) => Number(s.slice(0, 4));
export const dayOfMonth = (s: ISODate) => s.slice(8, 10);
const fmt = (s: ISODate, opts: Intl.DateTimeFormatOptions) => at(s).toLocaleDateString("pt-BR", { ...opts, timeZone: "UTC" });

/** pt-BR devolve mês e dia em minúsculas; o cabeçalho do caderno os quer capitalizados. */
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const monthName = (s: ISODate) => fmt(s, { month: "long" });
export const weekdayName = (s: ISODate) => fmt(s, { weekday: "long" });
/** "segunda", "terça" — o rótulo curto das colunas do spread. */
export const weekdayShort = (s: ISODate) => weekdayName(s).replace("-feira", "");
