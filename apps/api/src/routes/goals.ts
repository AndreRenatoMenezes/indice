import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, type Goal, type GoalContribution } from "@indice/db";
import { ContributeGoalInput, CreateGoalInput, type GoalProgressDto } from "@indice/shared";
import { parse, dec, dateOrNull } from "../lib/http.js";
import { fromISODate, todayISO } from "../lib/dates.js";
import { config } from "../config.js";
import { computeGoalProgress } from "../modules/goals/progress.js";
import { computeAccountBalances } from "../modules/finance/balance.js";
import { habitsToday } from "./habits.js";

type GoalWithContribs = Goal & { contributions: GoalContribution[] };

async function baselineFor(g: Goal, userId: string, today: string): Promise<number> {
  if (g.kind === "FINANCIAL" && g.linkedAccountId) {
    const [acc, txs] = await Promise.all([
      prisma.account.findUnique({ where: { id: g.linkedAccountId } }),
      prisma.transaction.findMany({ where: { userId, deletedAt: null, OR: [{ accountId: g.linkedAccountId }, { toAccountId: g.linkedAccountId }] }, select: { type: true, date: true, amount: true, accountId: true, toAccountId: true, invoiceId: true } }),
    ]);
    if (!acc) return 0;
    const b = computeAccountBalances([{ id: acc.id, openingBalance: acc.openingBalance, openingDate: dateOrNull(acc.openingDate) }], txs.map((t) => ({ ...t, date: dateOrNull(t.date)! })), today);
    return b.get(acc.id) ?? 0;
  }
  if (g.kind === "FINANCIAL" && g.linkedCategoryId) {
    const agg = await prisma.transaction.aggregate({ where: { userId, deletedAt: null, type: "INVESTMENT", categoryId: g.linkedCategoryId, date: { gte: g.startDate, lte: fromISODate(today) } }, _sum: { amount: true } });
    return dec(agg._sum.amount);
  }
  if (g.kind === "HABIT" && g.linkedHabitId) {
    const habits = await habitsToday(userId, today);
    const h = habits.find((x) => x.habit.id === g.linkedHabitId);
    return h ? h.streak : 0;
  }
  return 0;
}

export async function goalProgress(g: GoalWithContribs, userId: string, today: string): Promise<GoalProgressDto> {
  // Contribuições ligadas a transações já entram pelo baseline da conta/categoria; evita contar duas vezes.
  const manual = g.contributions.filter((c) => !(g.linkedAccountId || g.linkedCategoryId) || !c.transactionId);
  const baseline = await baselineFor(g, userId, today);
  const p = computeGoalProgress({
    targetValue: dec(g.targetValue), baseline,
    contributions: manual.map((c) => ({ date: dateOrNull(c.date)!, amount: dec(c.amount) })),
    startDate: dateOrNull(g.startDate)!, targetDate: dateOrNull(g.targetDate), today,
  });
  return {
    id: g.id, title: g.title, kind: g.kind, status: g.status, targetValue: dec(g.targetValue), currentValue: p.currentValue, progressPct: p.progressPct,
    startDate: dateOrNull(g.startDate)!, targetDate: dateOrNull(g.targetDate), daysRemaining: p.daysRemaining, paceMonthly: p.paceMonthly,
    requiredMonthly: p.requiredMonthly, projectedDate: p.projectedDate, icon: g.icon, color: g.color,
  };
}

export async function activeGoals(userId: string, today: string, limit = 3): Promise<GoalProgressDto[]> {
  const rows = await prisma.goal.findMany({ where: { userId, deletedAt: null, status: "ACTIVE" }, include: { contributions: true }, orderBy: [{ priority: "desc" }, { targetDate: "asc" }], take: limit });
  return Promise.all(rows.map((g) => goalProgress(g, userId, today)));
}

export async function goalsRoutes(app: FastifyInstance) {
  app.get("/goals", async (req, reply) => {
    const q = parse(z.object({ status: z.string().optional() }), req.query, reply);
    if (!q) return;
    const today = todayISO(config.timezone);
    const rows = await prisma.goal.findMany({ where: { userId: req.userId, deletedAt: null, ...(q.status ? { status: q.status as Goal["status"] } : {}) }, include: { contributions: true }, orderBy: [{ status: "asc" }, { priority: "desc" }] });
    return { goals: await Promise.all(rows.map((g) => goalProgress(g, req.userId, today))) };
  });

  app.post("/goals", async (req, reply) => {
    const body = parse(CreateGoalInput, req.body, reply);
    if (!body) return;
    const g = await prisma.goal.create({ data: { ...body, userId: req.userId, startDate: fromISODate(body.startDate ?? todayISO(config.timezone)), targetDate: body.targetDate ? fromISODate(body.targetDate) : null } });
    return reply.code(201).send({ id: g.id, title: g.title });
  });

  app.get("/goals/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const g = await prisma.goal.findFirst({ where: { id, userId: req.userId, deletedAt: null }, include: { contributions: { orderBy: { date: "asc" } }, milestones: { orderBy: { sortOrder: "asc" } } } });
    if (!g) return reply.code(404).send({ error: "not found" });
    const progress = await goalProgress(g, req.userId, todayISO(config.timezone));
    return { ...progress, description: g.description, unit: g.unit, milestones: g.milestones.map((m) => ({ id: m.id, title: m.title, targetValue: m.targetValue == null ? null : dec(m.targetValue), targetDate: dateOrNull(m.targetDate), achievedAt: m.achievedAt })), contributions: g.contributions.map((c) => ({ id: c.id, date: dateOrNull(c.date), amount: dec(c.amount), note: c.note, transactionId: c.transactionId })) };
  });

  app.post("/goals/:id/contributions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(ContributeGoalInput, req.body, reply);
    if (!body) return;
    const g = await prisma.goal.findFirst({ where: { id, userId: req.userId, deletedAt: null } });
    if (!g) return reply.code(404).send({ error: "not found" });
    const c = await prisma.goalContribution.create({ data: { goalId: id, date: fromISODate(body.date ?? todayISO(config.timezone)), amount: body.amount, note: body.note, transactionId: body.transactionId, source: "API" } });
    return reply.code(201).send({ id: c.id });
  });

  // Snapshot sob demanda (o job diário do Cloud Scheduler chama isto).
  app.post("/goals/:id/snapshot", async (req, reply) => {
    const { id } = req.params as { id: string };
    const today = todayISO(config.timezone);
    const g = await prisma.goal.findFirst({ where: { id, userId: req.userId, deletedAt: null }, include: { contributions: true } });
    if (!g) return reply.code(404).send({ error: "not found" });
    const p = await goalProgress(g, req.userId, today);
    const s = await prisma.goalSnapshot.upsert({
      where: { goalId_date: { goalId: id, date: fromISODate(today) } },
      update: { progressValue: p.currentValue, progressPct: p.progressPct, paceMonthly: p.paceMonthly, requiredMonthly: p.requiredMonthly, projectedDate: p.projectedDate ? fromISODate(p.projectedDate) : null },
      create: { goalId: id, date: fromISODate(today), progressValue: p.currentValue, progressPct: p.progressPct, paceMonthly: p.paceMonthly, requiredMonthly: p.requiredMonthly, projectedDate: p.projectedDate ? fromISODate(p.projectedDate) : null },
    });
    return reply.code(201).send({ id: s.id, date: today });
  });

  // Export plano para modelagem (Colab): contribuições + snapshots, JSON ou CSV.
  app.get("/goals/:id/export", async (req, reply) => {
    const { id } = req.params as { id: string };
    const q = parse(z.object({ format: z.enum(["json", "csv"]).default("json") }), req.query, reply);
    if (!q) return;
    const g = await prisma.goal.findFirst({ where: { id, userId: req.userId, deletedAt: null }, include: { contributions: { orderBy: { date: "asc" } }, snapshots: { orderBy: { date: "asc" } } } });
    if (!g) return reply.code(404).send({ error: "not found" });
    const contributions = g.contributions.map((c) => ({ date: dateOrNull(c.date), amount: dec(c.amount), transactionId: c.transactionId }));
    const snapshots = g.snapshots.map((s) => ({ date: dateOrNull(s.date), progressValue: dec(s.progressValue), progressPct: dec(s.progressPct), paceMonthly: s.paceMonthly == null ? null : dec(s.paceMonthly), requiredMonthly: s.requiredMonthly == null ? null : dec(s.requiredMonthly), projectedDate: dateOrNull(s.projectedDate) }));
    if (q.format === "csv") {
      const lines = ["kind,date,value,extra", ...contributions.map((c) => `contribution,${c.date},${c.amount},${c.transactionId ?? ""}`), ...snapshots.map((s) => `snapshot,${s.date},${s.progressValue},${s.progressPct}`)];
      return reply.header("content-type", "text/csv; charset=utf-8").send(lines.join("\n"));
    }
    return { goal: { id: g.id, title: g.title, kind: g.kind, targetValue: dec(g.targetValue), startDate: dateOrNull(g.startDate), targetDate: dateOrNull(g.targetDate) }, contributions, snapshots };
  });
}
