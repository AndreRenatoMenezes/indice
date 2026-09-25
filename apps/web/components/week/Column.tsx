"use client";

// Uma coluna da semana: um dia ou uma lista personalizada. Cabeçalho, as
// tarefas (área de soltar do arrastar) e o campo de criar no pé.
import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { EntryDto } from "@indice/shared";
import { Sketch } from "../sketch";
import { EntryRow, type RowOps } from "./EntryRow";
import { NewEntryInput } from "./NewEntryInput";
import { placeKey, type Place } from "./weekState";

export function Column({ place, title, aside, highlight, dropping, entries, ops, onCreate, menu, rowActions, titleSlot }: {
  place: Place;
  title: string;
  /** Canto direito do cabeçalho (o dia do mês). */
  aside?: ReactNode;
  /** O dia de hoje ganha a moldura. */
  highlight?: boolean;
  /** Algo está sendo arrastado por cima desta coluna. */
  dropping?: boolean;
  entries: EntryDto[];
  ops: RowOps;
  onCreate: (text: string) => void;
  menu?: ReactNode;
  rowActions?: (e: EntryDto) => ReactNode;
  /** Substitui o título (edição do nome de uma lista). */
  titleSlot?: ReactNode;
}) {
  const key = placeKey(place);
  const { setNodeRef } = useDroppable({ id: key, data: { place } });
  return (
    <section ref={setNodeRef} aria-label={title} className="relative min-w-0 px-4 py-4">
      {highlight && <Sketch radius={12} fill="var(--paper-raised)" stroke="var(--line)" />}
      {dropping && <Sketch radius={12} stroke="var(--accent)" dash />}
      <div className="relative">
        <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-[var(--rule-soft)] pb-1.5">
          {titleSlot ?? <span className="label min-w-0 break-words">{title}</span>}
          <span className="flex flex-none items-baseline gap-2">
            {aside}
            {menu}
          </span>
        </div>
        <SortableContext id={key} items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex min-h-6 flex-col gap-2.5">
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} place={place} ops={ops} actions={rowActions?.(e)} />
            ))}
          </ul>
        </SortableContext>
        <NewEntryInput onCreate={onCreate} label={title} />
      </div>
    </section>
  );
}
