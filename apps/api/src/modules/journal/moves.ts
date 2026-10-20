// Mover uma entrada entre coleções (dias e listas personalizadas): que tipo de
// movimento é e o que a cópia leva. Portado do "migrar" do bullet journal e do
// arrastar do WeekToDo (toDoList.vue).
import { sortEntries } from "./ordering.js";

export type MoveKind = "reorder" | "migrate" | "relocate";

// Mesma coleção → só reordena. Sair de um dia deixa rastro (migra: cópia no
// destino, origem vira ›). Sair de uma lista não deixa rastro: a lista não tem
// data, então nada foi "adiado" — a própria entrada muda de lugar.
export function moveKind(from: { id: string; kind: string }, to: { id: string; kind: string }): MoveKind {
  if (from.id === to.id) return "reorder";
  return from.kind === "DAILY" ? "migrate" : "relocate";
}

// Só tarefa aberta e raiz muda de dia ou de lista; subtarefa só reordena dentro da mãe.
export function canLeaveCollection(e: { status: string; parentId: string | null }): boolean {
  return e.status === "OPEN" && e.parentId == null;
}

type Copyable = {
  id: string;
  kind: string;
  status: string;
  text: string;
  description: string | null;
  time: string | null;
  alarm: boolean;
  priority: number;
  color: string | null;
  tags: string[];
  position: number;
  goalId: string | null;
  mediaItemId: string | null;
};

export type CopyTarget<D> = { collectionId: string; date: D };

function copyFields<E extends Copyable>(src: E) {
  return {
    kind: src.kind as E["kind"], text: src.text, description: src.description, time: src.time, alarm: src.alarm,
    priority: src.priority, color: src.color, tags: [...src.tags], goalId: src.goalId, mediaItemId: src.mediaItemId,
  };
}

function childFields<E extends Copyable, D>(c: E, target: CopyTarget<D>, position: number) {
  return {
    collectionId: target.collectionId, date: target.date, kind: c.kind as E["kind"], text: c.text, description: c.description,
    time: c.time, priority: c.priority, color: c.color, tags: [...c.tags], position, source: "SYSTEM" as const,
  };
}

// Cópia que segue para o destino: leva notas, marcadores e só as subtarefas
// abertas (as concluídas ficam no rastro). Não leva a regra de repetição: a
// ocorrência movida vira uma tarefa comum.
export function migrationCopy<E extends Copyable, D>(src: E, children: E[], target: CopyTarget<D>) {
  return {
    entry: { ...copyFields(src), collectionId: target.collectionId, date: target.date, migratedFromId: src.id, source: "SYSTEM" as const },
    children: sortEntries(children.filter((c) => c.status === "OPEN")).map((c, i) => childFields(c, target, i)),
  };
}

// Duplicar: nova tarefa aberta no mesmo lugar, com todas as subtarefas reabertas.
export function duplicateCopy<E extends Copyable & { collectionId: string }, D>(src: E & { date: D }, children: E[]) {
  const target = { collectionId: src.collectionId, date: src.date };
  return {
    entry: { ...copyFields(src), collectionId: target.collectionId, date: target.date, status: "OPEN" as const, source: "SYSTEM" as const },
    children: [...children].sort((a, b) => a.position - b.position).map((c, i) => ({ ...childFields(c, target, i), status: "OPEN" as const })),
  };
}
