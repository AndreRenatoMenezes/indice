"use client";

// O quadro da semana: um estado otimista só para dias, listas, painel e
// laterais interativas. Cada gesto aplica a mudança na hora (`useOptimistic`),
// chama a Server Action dentro de uma transição e, se ela falhar, o React
// descarta o estado otimista (a tela volta) e o aviso aparece.
import { useCallback, useOptimistic, useState, useTransition, type ReactNode } from "react";
import type { EntryDto } from "@indice/shared";
import { createEntry, updateEntry } from "@/lib/actions";
import { dayOfMonth, weekdayShort } from "@/lib/dates";
import { Column } from "./Column";
import type { RowOps } from "./EntryRow";
import { Toast, type ToastData } from "./Toast";
import { draftEntry, weekReducer, type Place, type WeekAction, type WeekState } from "./weekState";

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
      <main className="flex min-w-0 flex-col gap-7">
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {days.map((d) => (
            <Column
              key={d}
              title={`${weekdayShort(d)}${d === today ? " · hoje" : ""}`}
              aside={<span className="mono font-display text-[13px] text-[var(--ink-faint)]">{dayOfMonth(d)}</span>}
              highlight={d === today}
              entries={state.days[d] ?? []}
              ops={ops}
              onCreate={(text) => create({ kind: "day", date: d }, text)}
            />
          ))}
        </div>
        {habits}
      </main>

      <aside className="flex min-w-0 flex-col gap-5">
        {asideTop}
        {asideBottom}
      </aside>

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
