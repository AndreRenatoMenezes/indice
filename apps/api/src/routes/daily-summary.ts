import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@indice/db";
import { UpsertDailyLogInput, type DailySummaryDto } from "@indice/shared";
import { parse, decOrNull } from "../lib/http.js";
import { fromISODate, isoWeekday, todayISO } from "../lib/dates.js";
import { config } from "../config.js";
import { listEntriesForDate, toEntryDto } from "./entries.js";
import { habitsToday } from "./habits.js";
import { financeSummary } from "./finance.js";
import { activeGoals } from "./goals.js";
import { inProgressMedia } from "./media.js";

// Endpoint unificado da Visão Diária: um GET, uma tela, sem excesso.
export async function buildDailySummary(userId: string, date: string): Promise<DailySummaryDto> {
  const [journal, carried, log, habits, finance, goals, media] = await Promise.all([
    listEntriesForDate(userId, date),
    prisma.entry.findMany({ where: { userId, deletedAt: null, parentId: null, kind: "TASK", status: "OPEN", date: { lt: fromISODate(date) } }, orderBy: { date: "asc" }, take: 20 }),
    prisma.dailyLog.findUnique({ where: { userId_date: { userId, date: fromISODate(date) } } }),
    habitsToday(userId, date),
    financeSummary(userId, date),
    activeGoals(userId, date, 3),
    inProgressMedia(userId),
  ]);
  return {
    date,
    weekday: isoWeekday(date),
    journal: {
      collectionId: journal.collectionId,
      entries: journal.entries,
      carriedOver: carried.map((e) => toEntryDto(e)),
      log: log ? { date, wokeAt: log.wokeAt, mood: log.mood, energy: log.energy, sleepHours: decOrNull(log.sleepHours), highlights: log.highlights, reflection: log.reflection } : null,
    },
    habits,
    finance,
    goals,
    media,
  };
}

export async function dailySummaryRoutes(app: FastifyInstance) {
  app.get("/daily-summary", async (req, reply) => {
    const q = parse(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }), req.query, reply);
    if (!q) return;
    return buildDailySummary(req.userId, q.date ?? todayISO(config.timezone));
  });

  app.put("/daily-log/:date", async (req, reply) => {
    const { date } = req.params as { date: string };
    const body = parse(UpsertDailyLogInput, req.body, reply);
    if (!body) return;
    const log = await prisma.dailyLog.upsert({ where: { userId_date: { userId: req.userId, date: fromISODate(date) } }, update: body, create: { ...body, userId: req.userId, date: fromISODate(date) } });
    return { date, wokeAt: log.wokeAt, mood: log.mood, energy: log.energy, sleepHours: decOrNull(log.sleepHours), highlights: log.highlights, reflection: log.reflection };
  });
}
