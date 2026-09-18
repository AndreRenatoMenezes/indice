import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, type Entry, type Prisma } from "@indice/db";
import { CreateEntryInput, UpdateEntryInput, type EntryDto } from "@indice/shared";
import { parse, dateOrNull } from "../lib/http.js";
import { fromISODate } from "../lib/dates.js";
import { sortEntries } from "../modules/journal/ordering.js";

export function toEntryDto(e: Entry, children?: Entry[]): EntryDto {
  return {
    id: e.id, collectionId: e.collectionId, parentId: e.parentId, kind: e.kind, status: e.status,
    text: e.text, description: e.description, date: dateOrNull(e.date), time: e.time, alarm: e.alarm,
    priority: e.priority, color: e.color, tags: e.tags, position: e.position, goalId: e.goalId, mediaItemId: e.mediaItemId,
    children: children ? sortEntries(children).map((c) => toEntryDto(c)) : undefined,
  };
}

// Garante a Collection DAILY de uma data (cria sob demanda, como o WeekToDo
// criava a lista "YYYYMMDD" ao abrir o dia).
export async function ensureDailyCollection(userId: string, date: string) {
  const d = fromISODate(date);
  return prisma.collection.upsert({
    where: { userId_kind_date: { userId, kind: "DAILY", date: d } },
    update: {},
    create: { userId, kind: "DAILY", date: d, name: date },
  });
}

export async function listEntriesForDate(userId: string, date: string): Promise<{ collectionId: string | null; entries: EntryDto[] }> {
  const collection = await prisma.collection.findUnique({ where: { userId_kind_date: { userId, kind: "DAILY", date: fromISODate(date) } } });
  if (!collection) return { collectionId: null, entries: [] };
  const rows = await prisma.entry.findMany({ where: { collectionId: collection.id, deletedAt: null }, orderBy: { position: "asc" } });
  const byParent = new Map<string | null, Entry[]>();
  for (const r of rows) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r]);
  const roots = sortEntries(byParent.get(null) ?? []);
  return { collectionId: collection.id, entries: roots.map((r) => toEntryDto(r, byParent.get(r.id) ?? [])) };
}

export async function entriesRoutes(app: FastifyInstance) {
  // GET /entries?date=YYYY-MM-DD | ?collectionId=… | ?status=OPEN&before=YYYY-MM-DD
  app.get("/entries", async (req, reply) => {
    const q = parse(z.object({
      date: z.string().optional(), collectionId: z.string().optional(),
      status: z.string().optional(), before: z.string().optional(),
    }), req.query, reply);
    if (!q) return;
    if (q.date) return listEntriesForDate(req.userId, q.date);

    const where: Prisma.EntryWhereInput = { userId: req.userId, deletedAt: null, parentId: null };
    if (q.collectionId) where.collectionId = q.collectionId;
    if (q.status) where.status = q.status as Entry["status"];
    if (q.before) where.date = { lt: fromISODate(q.before) };
    const rows = await prisma.entry.findMany({ where, orderBy: [{ date: "asc" }, { position: "asc" }], take: 500 });
    return { entries: sortEntries(rows).map((r) => toEntryDto(r)) };
  });

  app.post("/entries", async (req, reply) => {
    const body = parse(CreateEntryInput, req.body, reply);
    if (!body) return;
    let collectionId = body.collectionId;
    let date: Date | null = null;
    if (body.parentId) {
      const parent = await prisma.entry.findFirst({ where: { id: body.parentId, userId: req.userId } });
      if (!parent) return reply.code(404).send({ error: "parent not found" });
      collectionId = parent.collectionId;
      date = parent.date;
    } else if (!collectionId) {
      const c = await ensureDailyCollection(req.userId, body.date ?? new Date().toISOString().slice(0, 10));
      collectionId = c.id;
      date = c.date;
    } else {
      const c = await prisma.collection.findFirst({ where: { id: collectionId, userId: req.userId } });
      if (!c) return reply.code(404).send({ error: "collection not found" });
      date = c.date;
    }
    const last = await prisma.entry.aggregate({ where: { collectionId, parentId: body.parentId ?? null }, _max: { position: true } });
    const created = await prisma.entry.create({
      data: {
        id: body.id, userId: req.userId, collectionId, parentId: body.parentId ?? null, kind: body.kind, text: body.text,
        description: body.description, date, time: body.time, alarm: body.alarm ?? false, priority: body.priority ?? 0,
        color: body.color, tags: body.tags ?? [], goalId: body.goalId, mediaItemId: body.mediaItemId,
        source: body.source ?? "API", position: (last._max.position ?? -1) + 1,
      },
    });
    return reply.code(201).send(toEntryDto(created));
  });

  app.patch("/entries/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(UpdateEntryInput, req.body, reply);
    if (!body) return;
    const existing = await prisma.entry.findFirst({ where: { id, userId: req.userId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: "not found" });
    const data: Prisma.EntryUpdateInput = {};
    for (const k of ["text", "description", "time", "alarm", "priority", "color", "tags", "kind", "status", "position"] as const) {
      if (body[k] !== undefined) (data as Record<string, unknown>)[k] = body[k];
    }
    if (body.goalId !== undefined) data.goal = body.goalId ? { connect: { id: body.goalId } } : { disconnect: true };
    if (body.mediaItemId !== undefined) data.mediaItem = body.mediaItemId ? { connect: { id: body.mediaItemId } } : { disconnect: true };
    if (body.status === "DONE" && existing.status !== "DONE") data.completedAt = new Date();
    if (body.status && body.status !== "DONE") data.completedAt = null;
    const updated = await prisma.entry.update({ where: { id }, data });
    return toEntryDto(updated);
  });

  // Migração de bullet (• → >): cria cópia na data-alvo e marca a origem como MIGRATED.
  app.post("/entries/:id/migrate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(z.object({ date: z.string() }), req.body, reply);
    if (!body) return;
    const src = await prisma.entry.findFirst({ where: { id, userId: req.userId, deletedAt: null }, include: { children: true } });
    if (!src) return reply.code(404).send({ error: "not found" });
    const target = await ensureDailyCollection(req.userId, body.date);
    const result = await prisma.$transaction(async (tx) => {
      const last = await tx.entry.aggregate({ where: { collectionId: target.id, parentId: null }, _max: { position: true } });
      const copy = await tx.entry.create({
        data: {
          userId: req.userId, collectionId: target.id, kind: src.kind, text: src.text, description: src.description, date: target.date,
          time: src.time, alarm: src.alarm, priority: src.priority, color: src.color, tags: src.tags, goalId: src.goalId,
          mediaItemId: src.mediaItemId, position: (last._max.position ?? -1) + 1, migratedFromId: src.id, source: "SYSTEM",
          children: {
            create: src.children.filter((c) => c.status === "OPEN").map((c, i) => ({
              userId: req.userId, collectionId: target.id, kind: c.kind, text: c.text, date: target.date, position: i, source: "SYSTEM" as const,
            })),
          },
        },
      });
      await tx.entry.update({ where: { id: src.id }, data: { status: "MIGRATED" } });
      return copy;
    });
    return reply.code(201).send(toEntryDto(result));
  });

  app.delete("/entries/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await prisma.entry.updateMany({ where: { id, userId: req.userId, deletedAt: null }, data: { deletedAt: new Date() } });
    if (!r.count) return reply.code(404).send({ error: "not found" });
    return reply.code(204).send();
  });

  app.get("/collections", async (req) => {
    const rows = await prisma.collection.findMany({ where: { userId: req.userId, deletedAt: null, archived: false, kind: { in: ["CUSTOM", "MONTHLY", "FUTURE"] } }, orderBy: { sortOrder: "asc" } });
    return { collections: rows.map((c) => ({ id: c.id, kind: c.kind, name: c.name, date: dateOrNull(c.date), color: c.color, sortOrder: c.sortOrder })) };
  });

  app.post("/collections", async (req, reply) => {
    const body = parse(z.object({ name: z.string().min(1), kind: z.enum(["CUSTOM", "FUTURE"]).default("CUSTOM"), color: z.string().optional() }), req.body, reply);
    if (!body) return;
    const c = await prisma.collection.create({ data: { userId: req.userId, kind: body.kind, name: body.name, color: body.color } });
    return reply.code(201).send({ id: c.id, kind: c.kind, name: c.name });
  });
}
