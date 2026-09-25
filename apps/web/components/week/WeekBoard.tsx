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
import type { EntryDto } from "@indice/shared";
import { createEntry, moveEntry, updateEntry } from "@/lib/actions";
import { dayOfMonth, weekdayShort } from "@/lib/dates";
import { Column } from "./Column";
import { EntryView, type RowOps } from "./EntryRow";
import { Toast, type ToastData } from "./Toast";
import {
  draftEntry, findEntry, isManual, parsePlaceKey, placeKey, rootsAt, samePlace, weekReducer, type Place, type WeekAction, type WeekState,
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

export type GoalOption = { id: string; title: string };

export function WeekBoard({ today, days, initial, habits, asideTop, asideBottom }: {
  /** "Hoje" no fuso da API. */
  today: string;
  /** Segunda a domingo da semana vista. */
  days: string[];
  initial: WeekState;
  goals: GoalOption[];
  /** Partes renderizadas no servidor (não mudam com os gestos). */
  habits: ReactNode;
  asideTop: ReactNode;
  asideBottom?: ReactNode;
}) {
  const [state, apply] = useOptimistic(initial, weekReducer);
  const [, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastData | null>(null);
  const [, setOpenId] = useState<string | null>(null);

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
        <Slot>{asideBottom}</Slot>
      </aside>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
