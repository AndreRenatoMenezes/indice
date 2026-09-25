"use client";

// Uma coluna da semana: um dia ou uma lista personalizada. Cabeçalho, as
// tarefas e o campo de criar no pé.
import type { ReactNode } from "react";
import type { EntryDto } from "@indice/shared";
import { Sketch } from "../sketch";
import { EntryRow, type RowOps } from "./EntryRow";
import { NewEntryInput } from "./NewEntryInput";

export function Column({ title, aside, highlight, entries, ops, onCreate, menu, rowActions }: {
  title: ReactNode;
  /** Canto direito do cabeçalho (o dia do mês). */
  aside?: ReactNode;
  /** O dia de hoje ganha a moldura. */
  highlight?: boolean;
  entries: EntryDto[];
  ops: RowOps;
  onCreate: (text: string) => void;
  menu?: ReactNode;
  rowActions?: (e: EntryDto) => ReactNode;
}) {
  const label = typeof title === "string" ? title : "a coluna";
  return (
    <section className="relative min-w-0 px-4 py-4">
      {highlight && <Sketch radius={12} fill="var(--paper-raised)" stroke="var(--line)" />}
      <div className="relative">
        <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-[var(--rule-soft)] pb-1.5">
          <span className="label min-w-0 break-words">{title}</span>
          <span className="flex flex-none items-baseline gap-2">
            {aside}
            {menu}
          </span>
        </div>
        <ul className="flex flex-col gap-2.5">
          {entries.map((e) => (
            <li key={e.id}>
              <EntryRow entry={e} ops={ops} actions={rowActions?.(e)} />
            </li>
          ))}
        </ul>
        <NewEntryInput onCreate={onCreate} label={label} />
      </div>
    </section>
  );
}
