// Listas personalizadas da semana ("Algum dia", "Projetos"): coleções CUSTOM,
// como as colunas extras do WeekToDo, com as entradas em árvore.
import type { FastifyInstance } from "fastify";
import { prisma, type Collection, type Entry } from "@indice/db";
import { CreateListInput, ReorderListsInput, UpdateListInput, type CustomListDto } from "@indice/shared";
import { parse } from "../lib/http.js";
import { entryTree } from "./entries.js";

function toListDto(c: Collection, entries: Entry[]): CustomListDto {
  return { id: c.id, name: c.name, color: c.color, sortOrder: c.sortOrder, entries: entryTree(entries) };
}

const liveList = (id: string, userId: string) => ({ id, userId, kind: "CUSTOM" as const, deletedAt: null });

export async function listsRoutes(app: FastifyInstance) {
  app.get("/lists", async (req) => {
    const lists = await prisma.collection.findMany({
      where: { userId: req.userId, kind: "CUSTOM", deletedAt: null, archived: false },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    const rows = await prisma.entry.findMany({
      where: { userId: req.userId, collectionId: { in: lists.map((l) => l.id) }, deletedAt: null },
      orderBy: { position: "asc" },
    });
    const byList = new Map<string, Entry[]>();
    for (const r of rows) byList.set(r.collectionId, [...(byList.get(r.collectionId) ?? []), r]);
    return { lists: lists.map((l) => toListDto(l, byList.get(l.id) ?? [])) };
  });

  app.post("/lists", async (req, reply) => {
    const body = parse(CreateListInput, req.body, reply);
    if (!body) return;
    const last = await prisma.collection.aggregate({ where: { userId: req.userId, kind: "CUSTOM", deletedAt: null }, _max: { sortOrder: true } });
    const list = await prisma.collection.create({
      data: { userId: req.userId, kind: "CUSTOM", name: body.name, color: body.color, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    return reply.code(201).send(toListDto(list, []));
  });

  app.patch("/lists/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = parse(UpdateListInput, req.body, reply);
    if (!body) return;
    const r = await prisma.collection.updateMany({ where: liveList(id, req.userId), data: body });
    if (!r.count) return reply.code(404).send({ error: "not found" });
    const list = await prisma.collection.findUniqueOrThrow({ where: { id } });
    const entries = await prisma.entry.findMany({ where: { collectionId: id, deletedAt: null } });
    return toListDto(list, entries);
  });

  // Ordem das listas = ordem dos ids; ids de outro usuário são ignorados.
  app.put("/lists/order", async (req, reply) => {
    const body = parse(ReorderListsInput, req.body, reply);
    if (!body) return;
    await prisma.$transaction(
      body.ids.map((id, i) => prisma.collection.updateMany({ where: { id, userId: req.userId, kind: "CUSTOM" }, data: { sortOrder: i } })),
    );
    return reply.code(204).send();
  });

  // Apagar a lista apaga as tarefas dela (a confirmação fica na interface).
  app.delete("/lists/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const now = new Date();
    const removed = await prisma.$transaction(async (tx) => {
      const r = await tx.collection.updateMany({ where: liveList(id, req.userId), data: { deletedAt: now } });
      if (!r.count) return false;
      await tx.entry.updateMany({ where: { collectionId: id, userId: req.userId, deletedAt: null }, data: { deletedAt: now } });
      return true;
    });
    if (!removed) return reply.code(404).send({ error: "not found" });
    return reply.code(204).send();
  });
}
