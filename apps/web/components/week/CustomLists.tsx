"use client";

// Faixa de listas personalizadas abaixo dos dias ("Algum dia", "Projetos"),
// como as colunas extras do WeekToDo. Cada lista é uma coluna igual às dos
// dias (mesmo arrastar); aqui mora só a faixa, o renomear e o "nova lista".
import { Fragment, useState, type ReactNode } from "react";
import type { CustomListDto } from "@indice/shared";
import { SectionLabel } from "../paper";
import { InlineEdit } from "./EntryRow";

export function CustomLists({ lists, onCreateList, onRename, renderList }: {
  lists: CustomListDto[];
  onCreateList: (name: string) => void;
  onRename: (list: CustomListDto, name: string) => void;
  /** Monta a coluna da lista; `title` é o nome (ou o campo de renomear). */
  renderList: (list: CustomListDto, title: ReactNode) => ReactNode;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState("");

  return (
    <section aria-label="listas personalizadas" className="flex flex-col gap-2">
      <SectionLabel>Listas</SectionLabel>
      <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {lists.map((l) => (
          <Fragment key={l.id}>
            {renderList(
              l,
              renaming === l.id ? (
                <InlineEdit value={l.name} onSave={(n) => onRename(l, n.slice(0, 60))} onDone={() => setRenaming(null)} className="label text-[11px]" />
              ) : (
                <span
                  className="label cursor-text break-words tracking-[0.14em]"
                  onDoubleClick={() => setRenaming(l.id)}
                  title="duplo clique para renomear"
                >
                  {l.name}
                </span>
              ),
            )}
          </Fragment>
        ))}
        <div className="px-4 py-4">
          <input
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                const n = name.trim();
                if (n) onCreateList(n);
                setName("");
              } else if (e.key === "Escape") setName("");
            }}
            placeholder="+ nova lista"
            aria-label="nova lista"
            className="input w-full border-b border-dashed border-[var(--rule-soft)] px-0 text-[15px] focus:border-[var(--line)]"
          />
        </div>
      </div>
    </section>
  );
}
