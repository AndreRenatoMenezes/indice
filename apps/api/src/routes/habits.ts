import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, type Habit, type HabitLog } from "@indice/db";
import { LogHabitInput, type HabitDto, type HabitLogDto, type HabitTodayDto } from "@indice/shared";
import { parse, decOrNull, dec } from "../lib/http.js";
import { addDays, fromISODate, hhmmToMinutes, isoWeekday, todayISO, toISODate } from "../lib/dates.js";
import { config } from "../config.js";

export function toHabitDto(h: Habit): HabitDto {
  return {
    id: h.id, name: h.name, icon: h.icon, color: h.color, kind: h.kind, unit: h.unit,
    targetValue: decOrNull(h.targetValue), targetTime: h.targetTime, weekdays: h.weekdays, sortOrder: h.sortOrder,
  };
}

export function toHabitLogDto(l: HabitLog): HabitLogDto {
  return { habitId: l.habitId, date: toISODate(l.date), value: dec(l.value), done: l.done, note: l.note };
}

// Resolve `done` contra a meta do hábito. BOOLEAN: value >= 1. COUNTER/DURATION:
// value >= targetValue. TIME: minutos <= targetTime (acordou até 05:30).
export function resolveDone(h: Habit, value: number): boolean {
  switch (h.kind) {
    case "BOOLEAN": return value >= 1;
    case "COUNTER":
    case "DURATION": return value >= (decOrNull(h.targetValue) ?? 1);
    case "TIME": return h.targetTime ? value <= hhmmToMinutes(h.targetTime) : value > 0;
  }
}

// Streak: dias consecutivos (só nos weekdays do hábito) terminando hoje ou ontem.
export function computeStreak(h: Habit, logs: Map<string, HabitLog>, today: string): number {
  let streak = 0;
  let d = today;
  const todayLog = logs.get(today);
  if (!todayLog?.done && h.weekdays.includes(isoWeekday(today))) d = addDays(today, -1);
  for (let i = 0; i < 400; i++) {
    if (!h.weekdays.includes(isoWeekday(d))) { d = addDays(d, -1); continue; }
    if (logs.get(d)?.done) { streak++; d = addDays(d, -1); continue; }
    break;
  }
  return streak;
}

export async function habitsToday(userId: string, date: string): Promise<HabitTodayDto[]> {
  const habits = await prisma.habit.findMany({ where: { userId, deletedAt: null, archivedAt: null, startDate: { lte: fromISODate(date) } }, orderBy: { sortOrder: "asc" } });
  if (!habits.length) return [];
  const logs = await prisma.habitLog.findMany({ where: { userId, habitId: { in: habits.map((h) => h.id) }, date: { gte: fromISODate(addDays(date, -400)), lte: fromISODate(date) } } });
  const byHabit = new Map<string, Map<string, HabitLog>>();
  for (const l of logs) {
    const m = byHabit.get(l.habitId) ?? new Map<string, HabitLog>();
    m.set(toISODate(l.date), l);
    byHabit.set(l.habitId, m);
  }
  return habits.map((h) => {
    const m = byHabit.get(h.id) ?? new Map<string, HabitLog>();
    const log = m.get(date) ?? null;
    return { habit: toHabitDto(h), log: log ? toHabitLogDto(log) : null, done: log?.done ?? false, streak: computeStreak(h, m, date), scheduledToday: h.weekdays.includes(isoWeekday(date)) };
  });
}

export async function habitsRoutes(app: FastifyInstance) {
  app.get("/habits", async (req) => {
    const rows = await prisma.habit.findMany({ where: { userId: req.userId, deletedAt: null, archivedAt: null }, orderBy: { sortOrder: "asc" } });
    return { habits: rows.map(toHabitDto) };
  });

  app.get("/habits/today", async (req, reply) => {
    const q = parse(z.object({ date: z.string().optional() }), req.query, reply);
    if (!q) return;
    return { date: q.date ?? todayISO(config.timezone), habits: await habitsToday(req.userId, q.date ?? todayISO(config.timezone)) };
  });

  app.post("/habits", async (req, reply) => {
    const body = parse(z.object({
      name: z.string().min(1), kind: z.enum(["BOOLEAN", "COUNTER", "DURATION", "TIME"]).default("BOOLEAN"),
      icon: z.string().optional(), color: z.string().optional(), unit: z.string().optional(),
      targetValue: z.number().optional(), targetTime: z.string().optional(), weekdays: z.array(z.number().int().min(1).max(7)).optional(),
      reminderAt: z.string().optional(), startDate: z.string().optional(),
    }), req.body, reply);
    if (!body) return;
    const count = await prisma.habit.count({ where: { userId: req.userId } });
    const h = await prisma.habit.create({ data: { ...body, userId: req.userId, sortOrder: count, startDate: fromISODate(body.startDate ?? todayISO(config.timezone)) } });
    return reply.code(201).send(toHabitDto(h));
  });

  // Marcação rápida (widget): idempotente por (habitId, date).
  app.put("/habits/:id/log", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(LogHabitInput, req.body, reply);
    if (!body) return;
    const h = await prisma.habit.findFirst({ where: { id, userId: req.userId, deletedAt: null } });
    if (!h) return reply.code(404).send({ error: "not found" });
    const date = body.date ?? todayISO(config.timezone);
    let value = body.value;
    if (h.kind === "TIME" && body.time) value = hhmmToMinutes(body.time);
    if (value == null) value = h.kind === "BOOLEAN" ? 1 : (h.kind === "TIME" ? hhmmToMinutes(new Intl.DateTimeFormat("en-GB", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date())) : 1);
    const done = resolveDone(h, value);
    const log = await prisma.habitLog.upsert({
      where: { habitId_date: { habitId: id, date: fromISODate(date) } },
      update: { value, done, note: body.note, source: body.source ?? "API" },
      create: { userId: req.userId, habitId: id, date: fromISODate(date), value, done, note: body.note, source: body.source ?? "API" },
    });
    return toHabitLogDto(log);
  });

  app.delete("/habits/:id/log", async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = parse(z.object({ date: z.string().optional() }), req.query, reply);
    if (!q) return;
    await prisma.habitLog.deleteMany({ where: { habitId: id, userId: req.userId, date: fromISODate(q.date ?? todayISO(config.timezone)) } });
    return reply.code(204).send();
  });

  // Histórico para gráficos/export: ?from=&to=
  app.get("/habits/:id/logs", async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = parse(z.object({ from: z.string(), to: z.string() }), req.query, reply);
    if (!q) return;
    const rows = await prisma.habitLog.findMany({ where: { habitId: id, userId: req.userId, date: { gte: fromISODate(q.from), lte: fromISODate(q.to) } }, orderBy: { date: "asc" } });
    return { logs: rows.map(toHabitLogDto) };
  });
}
