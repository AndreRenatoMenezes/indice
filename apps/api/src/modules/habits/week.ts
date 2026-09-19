// Régua semanal e consistência de um hábito, calculadas só a partir dos logs
// já carregados (sem ir ao banco): alimentam a tela Hábitos e o widget.
import { addDays, isoWeekday, type ISODate } from "../../lib/dates.js";

export type DayStatus = "done" | "miss" | "today" | "off" | "future";
export interface HabitDay { date: ISODate; status: DayStatus }

export interface HabitSchedule { weekdays: number[]; startDate: ISODate }

// Segunda a domingo da semana que contém `date`.
export function weekOf(date: ISODate): ISODate[] {
  const monday = addDays(date, 1 - isoWeekday(date));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export function dayStatus(h: HabitSchedule, day: ISODate, today: ISODate, done: (d: ISODate) => boolean): DayStatus {
  if (done(day)) return "done";
  if (!h.weekdays.includes(isoWeekday(day)) || day < h.startDate) return "off";
  if (day > today) return "future";
  return day === today ? "today" : "miss";
}

export function weekStates(h: HabitSchedule, today: ISODate, done: (d: ISODate) => boolean): HabitDay[] {
  return weekOf(today).map((date) => ({ date, status: dayStatus(h, date, today, done) }));
}

// % de dias escalados (weekdays, a partir de startDate) nos últimos `days`
// dias terminando em `today` que têm log `done`. Sem dias escalados → 0.
export function consistency(h: HabitSchedule, today: ISODate, done: (d: ISODate) => boolean, days = 30): number {
  let scheduled = 0;
  let hit = 0;
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    if (d < h.startDate || !h.weekdays.includes(isoWeekday(d))) continue;
    scheduled++;
    if (done(d)) hit++;
  }
  return scheduled ? Math.round((hit / scheduled) * 1000) / 10 : 0;
}
