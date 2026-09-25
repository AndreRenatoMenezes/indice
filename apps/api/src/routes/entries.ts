import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, type Collection, type Entry, type Prisma } from "@indice/db";
import { CreateEntryInput, MoveEntryInput, UpdateEntryInput, isoDate, type EntryDto } from "@indice/shared";
import { parse, dateOrNull } from "../lib/http.js";
import { daysBetween, fromISODate, todayISO } from "../lib/dates.js";
import { config } from "../config.js";
import { reposition, sortEntries } from "../modules/journal/ordering.js";
import { canLeaveCollection, migrationCopy, moveKind } from "../modules/journal/moves.js";

// Teto do intervalo `?from&to`: cobre um mês com as semanas de borda.
const MAX_RANGE_DAYS = 62;

export function toEntryDto(e: Entry, children?: Entry[]): EntryDto {
  return {
    id: e.id, collectionId: e.collectionId, parentId: e.parentId, kind: e.kind, status: e.status,
    text: e.text, description: e.description, date: dateOrNull(e.date), time: e.time, alarm: e.alarm,
    priority: e.priority, color: e.color, tags: e.tags, position: e.position, goalId: e.goalId, mediaItemId: e.mediaItemId,
    recurrenceRuleId: e.recurrenceRuleId,
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

// Raízes (em ordem de data e, dentro do dia, pela regra 1B) com as subtarefas em `children`.
export function entryTree(rows: Entry[]): EntryDto[] {
  const byParent = new Map<string | null, Entry[]>();
  for (const r of rows) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r]);
  const roots = sortEntries(byParent.get(null) ?? []).sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));
  return roots.map((r) => toEntryDto(r, byParent.get(r.id) ?? []));
}

export async function listEntriesForDate(userId: string, date: string): Promise<{ collectionId: string | null; entries: EntryDto[] }> {
  const collection = await prisma.collection.findUnique({ where: { userId_kind_date: { userId, kind: "DAILY", date: fromISODate(date) } } });
  if (!collection) return { collectionId: null, entries: [] };
  const rows = await prisma.entry.findMany({ where: { collectionId: collection.id, deletedAt: null }, orderBy: { position: "asc" } });
  return { collectionId: collection.id, entries: entryTree(rows) };
}

export async function listEntriesInRange(userId: string, from: string, to: string): Promise<EntryDto[]> {
  const rows = await prisma.entry.findMany({
    where: { userId, deletedAt: null, date: { gte: fromISODate(from), lte: fromISODate(to) } },
    orderBy: [{ date: "asc" }, { position: "asc" }],
  });
  return entryTree(rows);
}

export async function listEntriesInCollection(userId: string, collectionId: string): Promise<EntryDto[]> {
  const rows = await prisma.entry.findMany({ where: { userId, collectionId, deletedAt: null }, orderBy: { position: "asc" } });
  return entryTree(rows);
}

async function withChildren(e: Entry): Promise<EntryDto> {
  const children = await prisma.entry.findMany({ where: { parentId: e.id, deletedAt: null } });
  return toEntryDto(e, children);
}

type Tx = Prisma.TransactionClient;
type EntryWithChildren = Entry & { children: Entry[] };

// Grava as posições que `reposition` mudou entre as irmãs (mesma coleção e mesma mãe).
async function placeAmongSiblings(tx: Tx, collectionId: string, parentId: string | null, id: string, beforeId: string | null | undefined) {
  const siblings = await tx.entry.findMany({ where: { collectionId, parentId, deletedAt: null }, select: { id: true, status: true, time: true, position: true } });
  for (const c of reposition(siblings, id, beforeId)) await tx.entry.update({ where: { id: c.id }, data: { position: c.position } });
}

async function nextPosition(tx: Tx, collectionId: string): Promise<number> {
  const last = await tx.entry.aggregate({ where: { collectionId, parentId: null }, _max: { position: true } });
  return (last._max.position ?? -1) + 1;
}

// Sair de um dia: cópia no destino (com as subtarefas abertas) e rastro › na origem.
export async function migrateInto(tx: Tx, userId: string, src: EntryWithChildren, dest: Collection, beforeId?: string | null): Promise<Entry> {
  const { entry, children } = migrationCopy(src, src.children.filter((c) => !c.deletedAt), { collectionId: dest.id, date: dest.date });
  // `migratedFromId` é único: se a origem já foi migrada, reaberta e sai de novo, o rastro passa para a cópia nova.
  await tx.entry.updateMany({ where: { migratedFromId: src.id }, data: { migratedFromId: null } });
  const copy = await tx.entry.create({
    data: { ...entry, userId, position: await nextPosition(tx, dest.id), children: { create: children.map((c) => ({ ...c, userId })) } },
  });
  await tx.entry.update({ where: { id: src.id }, data: { status: "MIGRATED" } });
  await placeAmongSiblings(tx, dest.id, null, copy.id, beforeId);
  return tx.entry.findUniqueOrThrow({ where: { id: copy.id } });
}

// Sair de uma lista: a própria entrada (e as subtarefas) muda de coleção, sem rastro.
async function relocateInto(tx: Tx, src: Entry, dest: Collection, beforeId?: string | null): Promise<Entry> {
  await tx.entry.update({ where: { id: src.id }, data: { collectionId: dest.id, date: dest.date, position: await nextPosition(tx, dest.id) } });
  await tx.entry.updateMany({ where: { parentId: src.id }, data: { collectionId: dest.id, date: dest.date } });
  await placeAmongSiblings(tx, dest.id, null, src.id, beforeId);
  return tx.entry.findUniqueOrThrow({ where: { id: src.id } });
}

export type MoveResult = { ok: true; entry: Entry } | { ok: false; code: 400 | 404 | 409; error: string };

// Um só caminho para reordenar, migrar (origem é um dia) e realocar (origem é uma lista).
export async function moveEntry(userId: string, id: string, input: MoveEntryInput): Promise<MoveResult> {
  const entry = await prisma.entry.findFirst({
    where: { id, userId, deletedAt: null },
    include: { collection: true, children: { where: { deletedAt: null } } },
  });
  if (!entry) return { ok: false, code: 404, error: "not found" };
  if (entry.parentId && (input.date || input.collectionId)) return { ok: false, code: 400, error: "subtarefa só reordena dentro da tarefa" };

  let dest: Collection = entry.collection;
  if (input.date) dest = await ensureDailyCollection(userId, input.date);
  else if (input.collectionId) {
    const list = await prisma.collection.findFirst({ where: { id: input.collectionId, userId, kind: "CUSTOM", deletedAt: null } });
    if (!list) return { ok: false, code: 404, error: "list not found" };
    dest = list;
  }

  const kind = moveKind(entry.collection, dest);
  if (kind !== "reorder" && !canLeaveCollection(entry)) return { ok: false, code: 409, error: "só tarefa aberta e raiz muda de lugar" };

  const moved = await prisma.$transaction(async (tx) => {
    if (kind === "migrate") return migrateInto(tx, userId, entry, dest, input.beforeId);
    if (kind === "relocate") return relocateInto(tx, entry, dest, input.beforeId);
    await placeAmongSiblings(tx, entry.collectionId, entry.parentId, entry.id, input.beforeId);
    return tx.entry.findUniqueOrThrow({ where: { id: entry.id } });
  });
  return { ok: true, entry: moved };
}

export async function entriesRoutes(app: FastifyInstance) {
  // GET /entries?date=YYYY-MM-DD | ?from&to | ?collectionId=… | ?status=OPEN&before=YYYY-MM-DD
  app.get("/entries", async (req, reply) => {
    const q = parse(z.object({
      date: isoDate.optional(), collectionId: z.string().optional(),
      status: z.string().optional(), before: isoDate.optional(),
      from: isoDate.optional(), to: isoDate.optional(),
    }), req.query, reply);
    if (!q) return;
    if (q.date) return listEntriesForDate(req.userId, q.date);

    // Intervalo fechado, para montar a semana numa chamada só (árvore, como `?date=`).
    if (q.from || q.to) {
      if (!q.from || !q.to) return reply.code(400).send({ error: "from e to vêm juntos" });
      const span = daysBetween(q.from, q.to);
      if (span < 0 || span > MAX_RANGE_DAYS) return reply.code(400).send({ error: `intervalo de 0 a ${MAX_RANGE_DAYS} dias` });
      return { entries: await listEntriesInRange(req.userId, q.from, q.to) };
    }
    if (q.collectionId && !q.status && !q.before) return { entries: await listEntriesInCollection(req.userId, q.collectionId) };

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
      const c = await ensureDailyCollection(req.userId, body.date ?? todayISO(config.timezone));
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
    for (const k of ["text", "description", "time", "alarm", "priority", "color", "tags", "kind", "status"] as const) {
      if (body[k] !== undefined) (data as Record<string, unknown>)[k] = body[k];
    }
    if (body.goalId !== undefined) data.goal = body.goalId ? { connect: { id: body.goalId } } : { disconnect: true };
    if (body.mediaItemId !== undefined) data.mediaItem = body.mediaItemId ? { connect: { id: body.mediaItemId } } : { disconnect: true };
    if (body.status === "DONE" && existing.status !== "DONE") data.completedAt = new Date();
    if (body.status && body.status !== "DONE") data.completedAt = null;
    const updated = await prisma.entry.update({ where: { id }, data });
    return toEntryDto(updated);
  });

  // Reordenar no mesmo lugar, migrar de um dia (deixa rastro ›) ou realocar de uma lista (sem rastro).
  app.post("/entries/:id/move", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(MoveEntryInput, req.body, reply);
    if (!body) return;
    const r = await moveEntry(req.userId, id, body);
    if (!r.ok) return reply.code(r.code).send({ error: r.error });
    return withChildren(r.entry);
  });

  // Migração de bullet (• → >), usada pelo Diário e pelo Android: atalho de
  // "mover para a data, no fim das manuais".
  app.post("/entries/:id/migrate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(z.object({ date: isoDate }), req.body, reply);
    if (!body) return;
    const r = await moveEntry(req.userId, id, { date: body.date, beforeId: null });
    // Aqui subtarefa também é "não pode sair" (409), não pedido malformado.
    if (!r.ok) return reply.code(r.code === 400 ? 409 : r.code).send({ error: r.error });
    return reply.code(201).send(await withChildren(r.entry));
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
