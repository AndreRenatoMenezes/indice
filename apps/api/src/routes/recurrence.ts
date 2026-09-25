// Tarefas repetidas no formato do WeekToDo: a regra nasce de uma tarefa de um
// dia (a primeira ocorrência), guarda o molde e as opções no `template` e não
// se edita — para mudar, para-se e cria-se de novo. As ocorrências nascem na
// leitura (`materializeRecurrences`), de hoje em diante.
// Não importa nada de `entries.ts` (que importa daqui).
import type { FastifyInstance } from "fastify";
import { Prisma, prisma, type RecurrenceRule } from "@indice/db";
import { RecurrenceInput, type RecurrenceRuleDto } from "@indice/shared";
import { parse } from "../lib/http.js";
import { fromISODate, toISODate, todayISO } from "../lib/dates.js";
import { config } from "../config.js";
import { sortEntries } from "../modules/journal/ordering.js";
import { buildRRule, describeRule, plannedOccurrences, ruleEndDate, type RuleLike } from "../modules/journal/recurrence.js";

type EntryKind = "TASK" | "EVENT" | "NOTE";

// Formato de `RecurrenceRule.template` (coluna Json).
export type RuleTemplate = {
  kind: EntryKind;
  text: string;
  description: string | null;
  time: string | null;
  alarm: boolean;
  priority: number;
  color: string | null;
  tags: string[];
  goalId: string | null;
  mediaItemId: string | null;
  children: { kind: EntryKind; text: string }[];
  options: RecurrenceInput;
};

const templateOf = (r: RecurrenceRule) => r.template as unknown as RuleTemplate;

function toRuleLike(r: RecurrenceRule): RuleLike {
  return { id: r.id, rrule: r.rrule, startDate: toISODate(r.startDate), endDate: r.endDate ? toISODate(r.endDate) : null, active: r.active };
}

export function toRuleDto(r: RecurrenceRule): RecurrenceRuleDto {
  const t = templateOf(r);
  const startDate = toISODate(r.startDate);
  return { id: r.id, text: t.text, summary: describeRule(t.options, startDate), startDate, endDate: r.endDate ? toISODate(r.endDate) : null, options: t.options };
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

// Upsert da coleção DAILY que aguenta corrida: se outra requisição criou o dia
// entre a leitura e a escrita do upsert (P2002), lê a que ficou.
async function dailyCollection(userId: string, date: Date, name: string) {
  const where = { userId_kind_date: { userId, kind: "DAILY" as const, date } };
  try {
    return await prisma.collection.upsert({ where, update: {}, create: { userId, kind: "DAILY", date, name } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    return prisma.collection.findUniqueOrThrow({ where });
  }
}

// Cria as ocorrências que faltam em [max(from, hoje), to]. Uma transação por
// ocorrência; se outro aparelho criou a mesma (regra, data) antes, a PK de
// RecurrenceInstance barra (P2002) e aquela é ignorada. Ocorrência apagada ou
// migrada continua com a instância: não volta.
export async function materializeRecurrences(userId: string, from: string, to: string, today = todayISO(config.timezone)): Promise<void> {
  const lo = from > today ? from : today;
  if (lo > to) return;
  const rules = await prisma.recurrenceRule.findMany({
    where: {
      userId, active: true, deletedAt: null, startDate: { lte: fromISODate(to) },
      OR: [{ endDate: null }, { endDate: { gte: fromISODate(lo) } }],
    },
  });
  if (!rules.length) return;
  const instances = await prisma.recurrenceInstance.findMany({
    where: { ruleId: { in: rules.map((r) => r.id) }, date: { gte: fromISODate(lo), lte: fromISODate(to) } },
    select: { ruleId: true, date: true },
  });
  const existing = new Set(instances.map((i) => `${i.ruleId}|${toISODate(i.date)}`));
  const byId = new Map(rules.map((r) => [r.id, r]));

  for (const occ of plannedOccurrences(rules.map(toRuleLike), existing, lo, to)) {
    const t = templateOf(byId.get(occ.ruleId)!);
    const date = fromISODate(occ.date);
    const day = await dailyCollection(userId, date, occ.date);
    try {
      await prisma.$transaction(async (tx) => {
        const last = await tx.entry.aggregate({ where: { collectionId: day.id, parentId: null }, _max: { position: true } });
        const entry = await tx.entry.create({
          data: {
            userId, collectionId: day.id, date, kind: t.kind, text: t.text, description: t.description, time: t.time,
            alarm: t.alarm, priority: t.priority, color: t.color, tags: t.tags, goalId: t.goalId, mediaItemId: t.mediaItemId,
            recurrenceRuleId: occ.ruleId, source: "SYSTEM", position: (last._max.position ?? -1) + 1,
            children: {
              create: t.children.map((c, i) => ({ userId, collectionId: day.id, date, kind: c.kind, text: c.text, position: i, source: "SYSTEM" as const })),
            },
          },
        });
        await tx.recurrenceInstance.create({ data: { ruleId: occ.ruleId, date, entryId: entry.id } });
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
}

export async function recurrenceRoutes(app: FastifyInstance) {
  app.get("/recurrence-rules", async (req) => {
    const rows = await prisma.recurrenceRule.findMany({ where: { userId: req.userId, active: true, deletedAt: null }, orderBy: { createdAt: "asc" } });
    return { rules: rows.map(toRuleDto) };
  });

  // Faz de uma tarefa aberta de um dia a primeira ocorrência de uma regra nova.
  app.put("/entries/:id/recurrence", async (req, reply) => {
    const { id } = req.params as { id: string };
    const options = parse(RecurrenceInput, req.body, reply);
    if (!options) return;
    const entry = await prisma.entry.findFirst({
      where: { id, userId: req.userId, deletedAt: null },
      include: { collection: true, children: { where: { deletedAt: null } } },
    });
    if (!entry) return reply.code(404).send({ error: "not found" });
    if (entry.parentId || entry.status !== "OPEN" || entry.collection.kind !== "DAILY" || !entry.date || entry.recurrenceRuleId) {
      return reply.code(409).send({ error: "só tarefa aberta de um dia, sem repetição, pode repetir" });
    }
    const startDate = toISODate(entry.date);
    if (options.end.type === "until" && options.end.date < startDate) return reply.code(400).send({ error: "o fim vem antes do início" });

    const template: RuleTemplate = {
      kind: entry.kind, text: entry.text, description: entry.description, time: entry.time, alarm: entry.alarm,
      priority: entry.priority, color: entry.color, tags: entry.tags, goalId: entry.goalId, mediaItemId: entry.mediaItemId,
      children: sortEntries(entry.children).map((c) => ({ kind: c.kind, text: c.text })),
      options,
    };
    const endDate = ruleEndDate(options, startDate);
    const rule = await prisma.$transaction(async (tx) => {
      const rule = await tx.recurrenceRule.create({
        data: {
          userId: req.userId, rrule: buildRRule(options, startDate), startDate: entry.date!,
          endDate: endDate ? fromISODate(endDate) : null, template: template as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.entry.update({ where: { id: entry.id }, data: { recurrenceRuleId: rule.id } });
      await tx.recurrenceInstance.create({ data: { ruleId: rule.id, date: entry.date!, entryId: entry.id } });
      return rule;
    });
    return reply.code(201).send(toRuleDto(rule));
  });

  // Parar de repetir: some com as ocorrências futuras ainda abertas; as
  // passadas e as concluídas ficam, soltas da regra.
  app.delete("/recurrence-rules/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const rule = await prisma.recurrenceRule.findFirst({ where: { id, userId: req.userId, deletedAt: null } });
    if (!rule) return reply.code(404).send({ error: "not found" });
    const today = fromISODate(todayISO(config.timezone));
    const now = new Date();
    await prisma.$transaction([
      prisma.recurrenceRule.update({ where: { id }, data: { active: false, deletedAt: now } }),
      prisma.entry.updateMany({
        where: { recurrenceRuleId: id, userId: req.userId, deletedAt: null, status: "OPEN", date: { gte: today } },
        data: { deletedAt: now },
      }),
      prisma.entry.updateMany({ where: { recurrenceRuleId: id, userId: req.userId, deletedAt: null }, data: { recurrenceRuleId: null } }),
    ]);
    return reply.code(204).send();
  });
}
