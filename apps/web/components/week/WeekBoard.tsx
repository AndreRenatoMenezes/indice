"use client";

// O quadro da semana: um estado otimista só para dias, listas, painel e
// laterais interativas. Cada gesto aplica a mudança na hora (`useOptimistic`),
// chama a Server Action dentro de uma transição e, se ela falhar, o React
// descarta o estado otimista (a tela volta) e o aviso aparece.
import { useCallback, useOptimistic, useState, useTransition, type ReactNode } from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCorners, pointerWithin, rectIntersection, useSensor, useSensors,
  type Announcements, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { EntryDto, UpdateEntryInput } from "@indice/shared";
import { batchEntries, createEntry, duplicateEntry, moveEntry, updateEntry } from "@/lib/actions";
import { dateBR } from "@/lib/api";
import { addDays, capitalize, dayOfMonth, weekdayShort } from "@/lib/dates";
import { Column } from "./Column";
import { ColumnMenu } from "./ColumnMenu";
import { EntryPanel, placeLabel, type GoalOption, type PanelOps } from "./EntryPanel";
import { EntryView, type RowOps } from "./EntryRow";
import { PendingAside } from "./PendingAside";
import { SubtaskList, type SubtaskOps } from "./SubtaskList";
import { Toast, type ToastData } from "./Toast";
import {
  canMove, draftEntry, entryAsText, findEntry, isManual, listAsText, parsePlaceKey, placeKey, rootsAt, samePlace, weekReducer,
  type Place, type WeekAction, type WeekState,
} from "./weekState";

// Com vários dias e listas, o ponteiro decide a coluna; dentro dela, a tarefa
// mais próxima. Sem ponteiro (teclado), vale o retângulo arrastado.
const collision: CollisionDetection = (args) => {
  const hits = args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);
  const item = hits.find((h) => !parsePlaceKey(String(h.id)));
  if (item) return [item];
  const column = hits[0];
  if (!column) return closestCorners(args);
  const inside = args.droppableContainers.filter((c) => c.data.current?.sortable?.containerId === column.id);
  return inside.length ? closestCorners({ ...args, droppableContainers: inside }) : [column];
};

const announcements: Announcements = {
  onDragStart: () => "Tarefa pega. Use as setas para mover e espaço para soltar; Esc cancela.",
  onDragOver: ({ over }) => (over ? "Sobre outra posição." : "Fora de uma lista."),
  onDragEnd: ({ over }) => (over ? "Tarefa solta." : "Tarefa solta fora de uma lista; nada mudou."),
  onDragCancel: () => "Arrasto cancelado; nada mudou.",
};

// Parte vinda do servidor como filho único: elemento do RSC entre irmãos do
// cliente dispara o aviso de `key` no React 19 em desenvolvimento.
const Slot = ({ children }: { children: ReactNode }) => <div className="contents">{children}</div>;

export function WeekBoard({ today, days, initial, goals, habits, asideTop }: {
  /** "Hoje" no fuso da API. */
  today: string;
  /** Segunda a domingo da semana vista. */
  days: string[];
  initial: WeekState;
  goals: GoalOption[];
  /** Partes renderizadas no servidor (não mudam com os gestos). */
  habits: ReactNode;
  asideTop: ReactNode;
}) {
  const [state, apply] = useOptimistic(initial, weekReducer);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastData | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const notify = useCallback((message: string, extra: Omit<ToastData, "id" | "message"> = {}) => {
    setToast({ id: Date.now(), message, ...extra });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  /** Aplica na hora, grava e, se a gravação falhar, avisa (a tela volta sozinha). */
  const run = useCallback((actions: WeekAction | WeekAction[], work: () => Promise<unknown>, onDone?: () => void) => {
    startTransition(async () => {
      for (const a of Array.isArray(actions) ? actions : [actions]) apply(a);
      try {
        await work();
        onDone?.();
      } catch {
        notify("Não deu para salvar. Voltei ao estado anterior.", { tone: "error" });
      }
    });
  }, [apply, notify]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Toque longo arrasta; toque curto (ou deslizar) rola a página.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );
  const [dragging, setDragging] = useState<EntryDto | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  /** Mover uma raiz (arrastar, "mudar de dia"): mesmo lugar reordena; sair de um dia deixa rastro. */
  const move = (entry: EntryDto, from: Place, to: Place, beforeId: string | null) => {
    if (samePlace(from, to)) {
      if (!isManual(entry)) return notify("A hora define a ordem.");
      return run({ type: "move", id: entry.id, to, beforeId, copyId: "" }, () => moveEntry(entry.id, { beforeId }));
    }
    run({ type: "move", id: entry.id, to, beforeId, copyId: crypto.randomUUID() }, () =>
      moveEntry(entry.id, to.kind === "day" ? { date: to.date, beforeId } : { collectionId: to.id, beforeId }),
    );
  };

  const placeOf = (id: string): Place | null => parsePlaceKey(id) ?? findEntry(state, id)?.place ?? null;

  const onDragStart = ({ active }: DragStartEvent) => setDragging(findEntry(state, String(active.id))?.entry ?? null);
  const onDragOver = ({ over }: DragOverEvent) => {
    const p = over ? placeOf(String(over.id)) : null;
    setOverKey(p ? placeKey(p) : null);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    setOverKey(null);
    const found = findEntry(state, String(active.id));
    if (!over || !found) return;
    const { entry, place: from } = found;
    const to = placeOf(String(over.id));
    if (!to) return;
    const list = rootsAt(state, to) ?? [];
    const overIndex = list.findIndex((e) => e.id === over.id);
    let beforeId: string | null = null;
    if (overIndex >= 0) {
      if (samePlace(from, to)) {
        const activeIndex = list.findIndex((e) => e.id === entry.id);
        if (activeIndex === overIndex) return; // soltou no mesmo lugar: nada a gravar
        // Mesma semântica do arrayMove: descendo, fica depois do alvo.
        beforeId = activeIndex < overIndex ? (list[overIndex + 1]?.id ?? null) : list[overIndex]!.id;
      } else {
        const dragged = active.rect.current.translated;
        const below = !!dragged && dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2;
        beforeId = below ? (list[overIndex + 1]?.id ?? null) : list[overIndex]!.id;
      }
    }
    move(entry, from, to, beforeId);
  };
  const onDragCancel = () => { setDragging(null); setOverKey(null); };

  const create = (place: Place, text: string) => {
    const entry = draftEntry({ id: crypto.randomUUID(), text, date: place.kind === "day" ? place.date : null });
    run({ type: "create", place, entry }, () =>
      createEntry({ id: entry.id, text, kind: "TASK", ...(place.kind === "day" ? { date: place.date } : { collectionId: place.id }) }),
    );
  };

  const panel: PanelOps = {
    update: (e, patch: UpdateEntryInput) => run({ type: "update", ids: [e.id], patch: patch as Partial<EntryDto> }, () => updateEntry(e.id, patch)),
    moveTo: (e, from, to) => {
      move(e, from, to, null);
      // Sair de um dia deixa só o rastro aqui: o painel fecha. Sair de uma lista leva a própria tarefa.
      if (from.kind === "day") setOpenId(null);
      if (to.kind === "day" && !state.days[to.date]) notify(`Foi para ${dateBR(to.date)}, fora desta semana.`);
      else if (from.kind === "day") notify(`Foi para ${placeLabel(to, state.lists)}.`);
    },
    duplicate: (e, place) => {
      const id = crypto.randomUUID();
      const copy: EntryDto = {
        ...e, id, status: "OPEN", recurrenceRuleId: null, position: Number.MAX_SAFE_INTEGER,
        children: e.children?.map((c) => ({ ...c, id: `${id}:${c.id}`, parentId: id, status: "OPEN" })),
      };
      run({ type: "create", place, entry: copy }, () => duplicateEntry(e.id), () => notify("Duplicada."));
    },
    copy: (e) => {
      navigator.clipboard.writeText(entryAsText(e)).then(() => notify("Texto copiado."), () => notify("Não deu para copiar.", { tone: "error" }));
    },
    remove: (e, place) => {
      setOpenId(null);
      run({ type: "remove", ids: [e.id] }, () => batchEntries({ action: "delete", ids: [e.id] }), () =>
        notify("Tarefa apagada.", {
          undo: () => run({ type: "create", place, entry: e }, () => batchEntries({ action: "restore", ids: [e.id] })),
        }),
      );
    },
    close: () => setOpenId(null),
  };
  const opened = openId ? findEntry(state, openId) : null;

  const sub: SubtaskOps = {
    create: (parent, text) => {
      const entry = draftEntry({ id: crypto.randomUUID(), text, parentId: parent.id, date: parent.date });
      run({ type: "createChild", parentId: parent.id, entry }, () => createEntry({ id: entry.id, parentId: parent.id, text, kind: "TASK" }));
    },
    toggle: (c) => {
      const status = c.status === "DONE" ? "OPEN" : "DONE";
      run({ type: "update", ids: [c.id], patch: { status } }, () => updateEntry(c.id, { status }));
    },
    rename: (c, text) => run({ type: "update", ids: [c.id], patch: { text } }, () => updateEntry(c.id, { text })),
    move: (parent, c, beforeId) => run({ type: "moveChild", parentId: parent.id, id: c.id, beforeId }, () => moveEntry(c.id, { beforeId })),
    remove: (parent, c) =>
      run({ type: "remove", ids: [c.id] }, () => batchEntries({ action: "delete", ids: [c.id] }), () =>
        notify("Subtarefa apagada.", {
          undo: () => run({ type: "createChild", parentId: parent.id, entry: c }, () => batchEntries({ action: "restore", ids: [c.id] })),
        }),
      ),
  };

  // ── ações de vários de uma vez (menu do dia, lateral) ──
  const copyText = (text: string) =>
    navigator.clipboard.writeText(text).then(() => notify("Lista copiada."), () => notify("Não deu para copiar.", { tone: "error" }));

  const completeAll = (entries: EntryDto[]) => {
    const ids = entries.filter((e) => e.status === "OPEN").map((e) => e.id);
    if (!ids.length) return notify("Nada aberto para concluir.");
    run({ type: "update", ids, patch: { status: "DONE" } }, () => batchEntries({ action: "complete", ids }));
  };

  /** Migra raízes abertas (com rastro) para uma data, em lote. */
  const migrateAll = (items: { entry: EntryDto; place: Place }[], date: string, done?: () => void) => {
    const movable = items.filter(({ entry, place }) => canMove(entry) && !samePlace(place, { kind: "day", date }));
    if (!movable.length) return notify("Nada pendente para levar.");
    const to: Place = { kind: "day", date };
    run(
      movable.map(({ entry }) => ({ type: "move" as const, id: entry.id, to, beforeId: null, copyId: crypto.randomUUID() })),
      () => batchEntries({ action: "migrate", ids: movable.map(({ entry }) => entry.id), date }),
      done,
    );
  };

  /** Apaga rastros › (um ou vários) com "desfazer". */
  const clearTraces = (items: { entry: EntryDto; place: Place }[]) => {
    const ids = items.map(({ entry }) => entry.id);
    if (!ids.length) return;
    run({ type: "remove", ids }, () => batchEntries({ action: "delete", ids }), () =>
      notify(ids.length === 1 ? "Rastro apagado." : `${ids.length} migradas apagadas.`, {
        undo: () => run(items.map(({ entry, place }) => ({ type: "create" as const, place, entry })), () => batchEntries({ action: "restore", ids })),
      }),
    );
  };

  const dayItems = (pred: (e: EntryDto) => boolean) =>
    days.flatMap((d) => (state.days[d] ?? []).filter(pred).map((entry) => ({ entry, place: { kind: "day", date: d } as Place })));
  const pending = dayItems((e) => e.status === "OPEN" && !!e.date && e.date < today);
  const traces = dayItems((e) => e.status === "MIGRATED");

  const dayMenu = (d: string) => {
    const entries = state.days[d] ?? [];
    const tomorrow = addDays(d, 1);
    const title = `${capitalize(weekdayShort(d))}, ${dateBR(d).slice(0, 5)}`;
    return (
      <ColumnMenu
        label={title}
        items={[
          { label: "concluir todas", onSelect: () => completeAll(entries) },
          {
            label: "adiar pendentes para amanhã",
            onSelect: () =>
              migrateAll(entries.map((entry) => ({ entry, place: { kind: "day", date: d } })), tomorrow, () => {
                if (!state.days[tomorrow]) notify(`Pendentes foram para ${weekdayShort(tomorrow)}, ${dateBR(tomorrow).slice(0, 5)} — próxima semana.`);
              }),
          },
          { label: "copiar a lista", onSelect: () => copyText(listAsText(title, entries)) },
        ]}
      />
    );
  };

  const rowActions = (place: Place) => (e: EntryDto) =>
    e.status === "MIGRATED" ? (
      <button
        type="button"
        title="apagar rastro"
        aria-label={`apagar rastro de ${e.text}`}
        onClick={(ev) => { ev.stopPropagation(); clearTraces([{ entry: e, place }]); }}
        onDoubleClick={(ev) => ev.stopPropagation()}
        className="flex-none cursor-pointer text-[var(--ink-faint)] opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        ×
      </button>
    ) : null;

  const ops: RowOps = {
    toggle: (e: EntryDto) => {
      const status = e.status === "DONE" ? "OPEN" : "DONE";
      run({ type: "update", ids: [e.id], patch: { status } }, () => updateEntry(e.id, { status }));
    },
    rename: (e: EntryDto, text: string) => run({ type: "update", ids: [e.id], patch: { text } }, () => updateEntry(e.id, { text })),
    open: (id: string) => setOpenId(id),
  };

  return (
    <div className="mt-8 grid items-start gap-11 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
      <DndContext
        id="semana" // ids de acessibilidade estáveis entre o SSR e a hidratação
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{ announcements, screenReaderInstructions: { draggable: "Para arrastar, aperte espaço; as setas movem; espaço solta; Esc cancela." } }}
      >
        <main className="flex min-w-0 flex-col gap-7">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {days.map((d) => {
              const place: Place = { kind: "day", date: d };
              return (
                <Column
                  key={d}
                  place={place}
                  title={`${weekdayShort(d)}${d === today ? " · hoje" : ""}`}
                  aside={<span className="mono font-display text-[13px] text-[var(--ink-faint)]">{dayOfMonth(d)}</span>}
                  highlight={d === today}
                  dropping={overKey === placeKey(place)}
                  entries={state.days[d] ?? []}
                  ops={ops}
                  onCreate={(text) => create(place, text)}
                  menu={dayMenu(d)}
                  rowActions={rowActions(place)}
                />
              );
            })}
          </div>
          <Slot>{habits}</Slot>
        </main>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="rounded bg-[var(--card)] px-2 py-1 shadow-[0_2px_10px_rgba(34,31,28,0.18)]">
              <EntryView entry={dragging} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <aside className="flex min-w-0 flex-col gap-5">
        <Slot>{asideTop}</Slot>
        <PendingAside
          pending={pending.map(({ entry }) => entry)}
          traces={traces.length}
          onOpen={setOpenId}
          onMigrateAll={() =>
            migrateAll(pending, today, () => { if (!state.days[today]) notify(`Pendentes foram para hoje, ${dateBR(today).slice(0, 5)}.`); })
          }
          onClearTraces={() => clearTraces(traces)}
        />
      </aside>

      {opened && !opened.parent && (
        <EntryPanel
          key={opened.entry.id}
          entry={opened.entry}
          place={opened.place}
          days={days}
          lists={state.lists}
          goals={goals}
          ops={panel}
          subtasks={<SubtaskList parent={opened.entry} ops={sub} />}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
