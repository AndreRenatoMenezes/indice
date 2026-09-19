import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma, type MediaItem } from "@indice/db";
import { CreateMediaItemInput, CreateMediaNoteInput, UpdateMediaItemInput, type MediaItemDto } from "@indice/shared";
import { parse, decOrNull, dateOrNull } from "../lib/http.js";
import { fromISODate, todayISO } from "../lib/dates.js";
import { config } from "../config.js";

export function toMediaDto(m: MediaItem): MediaItemDto {
  return {
    id: m.id, kind: m.kind, title: m.title, creator: m.creator, year: m.year, platform: m.platform, status: m.status, rating: m.rating,
    progress: decOrNull(m.progress), progressTotal: decOrNull(m.progressTotal), progressUnit: m.progressUnit, tags: m.tags,
    startedAt: dateOrNull(m.startedAt), finishedAt: dateOrNull(m.finishedAt),
  };
}

export async function inProgressMedia(userId: string): Promise<MediaItemDto[]> {
  const rows = await prisma.mediaItem.findMany({ where: { userId, deletedAt: null, status: "IN_PROGRESS" }, orderBy: { updatedAt: "desc" }, take: 5 });
  return rows.map(toMediaDto);
}

export async function mediaRoutes(app: FastifyInstance) {
  app.get("/media", async (req, reply) => {
    const q = parse(z.object({ kind: z.string().optional(), status: z.string().optional() }), req.query, reply);
    if (!q) return;
    const rows = await prisma.mediaItem.findMany({ where: { userId: req.userId, deletedAt: null, ...(q.kind ? { kind: q.kind as MediaItem["kind"] } : {}), ...(q.status ? { status: q.status as MediaItem["status"] } : {}) }, orderBy: { updatedAt: "desc" } });
    return { items: rows.map(toMediaDto) };
  });

  app.post("/media", async (req, reply) => {
    const body = parse(CreateMediaItemInput, req.body, reply);
    if (!body) return;
    const m = await prisma.mediaItem.create({ data: { ...body, userId: req.userId, startedAt: body.status === "IN_PROGRESS" ? fromISODate(todayISO(config.timezone)) : null } });
    return reply.code(201).send(toMediaDto(m));
  });

  app.get("/media/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const m = await prisma.mediaItem.findFirst({ where: { id, userId: req.userId, deletedAt: null }, include: { notes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } }, sessions: { orderBy: { date: "desc" }, take: 30 } } });
    if (!m) return reply.code(404).send({ error: "not found" });
    return { ...toMediaDto(m), notes: m.notes.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, position: n.position, createdAt: n.createdAt })), sessions: m.sessions.map((s) => ({ id: s.id, date: dateOrNull(s.date), durationMin: s.durationMin, progressDelta: decOrNull(s.progressDelta), note: s.note })) };
  });

  app.patch("/media/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(UpdateMediaItemInput, req.body, reply);
    if (!body) return;
    const existing = await prisma.mediaItem.findFirst({ where: { id, userId: req.userId, deletedAt: null } });
    if (!existing) return reply.code(404).send({ error: "not found" });
    const today = fromISODate(todayISO(config.timezone));
    const m = await prisma.mediaItem.update({ where: { id }, data: { ...body, ...(body.status === "IN_PROGRESS" && !existing.startedAt ? { startedAt: today } : {}), ...(body.status === "DONE" ? { finishedAt: today } : {}) } });
    return toMediaDto(m);
  });

  app.post("/media/:id/notes", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(CreateMediaNoteInput, req.body, reply);
    if (!body) return;
    const m = await prisma.mediaItem.findFirst({ where: { id, userId: req.userId, deletedAt: null } });
    if (!m) return reply.code(404).send({ error: "not found" });
    const n = await prisma.mediaNote.create({ data: { ...body, mediaItemId: id } });
    return reply.code(201).send({ id: n.id });
  });

  app.post("/media/:id/sessions", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(z.object({ date: z.string().optional(), durationMin: z.number().int().optional(), progressDelta: z.number().optional(), note: z.string().optional(), source: z.enum(["WEB", "ANDROID", "WIDGET", "API"]).optional() }), req.body, reply);
    if (!body) return;
    const m = await prisma.mediaItem.findFirst({ where: { id, userId: req.userId, deletedAt: null } });
    if (!m) return reply.code(404).send({ error: "not found" });
    const s = await prisma.$transaction(async (tx) => {
      const created = await tx.mediaSession.create({ data: { mediaItemId: id, date: fromISODate(body.date ?? todayISO(config.timezone)), durationMin: body.durationMin, progressDelta: body.progressDelta, note: body.note, source: body.source ?? "API" } });
      if (body.progressDelta) await tx.mediaItem.update({ where: { id }, data: { progress: { increment: body.progressDelta } } });
      return created;
    });
    return reply.code(201).send({ id: s.id });
  });
}
