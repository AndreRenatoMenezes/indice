"use client";

// Uma tarefa na semana: o bullet do caderno com o marcador clicável (concluir /
// reabrir), clique que abre o painel, duplo clique que edita ali mesmo e os
// selos (hora, cor, prioridade, subtarefas, nota, repetição). A linha é
// arrastável (mouse, toque longo, teclado) quando a tarefa é raiz e aberta.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { EntryDto } from "@indice/shared";
import { Bullet } from "../paper";
import { canMove, type Place } from "./weekState";

export type RowOps = {
  toggle: (e: EntryDto) => void;
  rename: (e: EntryDto, text: string) => void;
  open: (id: string) => void;
};

// Signifiers do método (os mesmos do `Bullet`), para o marcador virar botão.
export function glyph(e: Pick<EntryDto, "kind" | "status">): string {
  if (e.status === "DONE") return "✕";
  if (e.status === "MIGRATED") return "›";
  if (e.status === "SCHEDULED") return "‹";
  if (e.status === "CANCELLED") return "";
  return e.kind === "EVENT" ? "○" : e.kind === "NOTE" ? "—" : "•";
}

export function Badges({ entry }: { entry: EntryDto }) {
  const kids = entry.children ?? [];
  const done = kids.filter((c) => c.status === "DONE").length;
  return (
    <span className="flex flex-none items-baseline gap-1.5 text-xs text-[var(--ink-soft)]">
      {entry.color && <span role="img" aria-label="cor" className="inline-block h-2 w-2 self-center rounded-full" style={{ background: entry.color }} />}
      {entry.priority > 0 && <span title={`prioridade ${entry.priority}`} className="text-[var(--red)]">{"*".repeat(entry.priority)}</span>}
      {kids.length > 0 && <span className="mono" title="subtarefas concluídas">{done}/{kids.length}</span>}
      {entry.description && <span title="tem nota">¶</span>}
      {entry.recurrenceRuleId && <span title="repete">↻</span>}
    </span>
  );
}

/** Texto editável: Enter salva, Esc desiste; vazio mantém o anterior. */
export function InlineEdit({ value, onSave, onDone, className = "" }: { value: string; onSave: (text: string) => void; onDone: () => void; className?: string }) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  const finish = (save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const t = text.trim();
    if (save && t && t !== value) onSave(t);
    onDone();
  };
  return (
    <input
      ref={ref}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !e.nativeEvent.isComposing) finish(true);
        else if (e.key === "Escape") { e.preventDefault(); finish(false); }
      }}
      onBlur={() => finish(true)}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`input w-full border-b border-[var(--line)] px-0 ${className}`}
      aria-label="editar texto"
    />
  );
}

/** Aparência da linha (também usada na "sombra" que acompanha o arrasto). */
export function EntryView({ entry, ops, actions }: { entry: EntryDto; ops?: RowOps; actions?: ReactNode }) {
  const toggleable = !!ops && (entry.status === "OPEN" || entry.status === "DONE");
  const migrated = entry.status === "MIGRATED";
  return (
    <div className={migrated ? "[&_span.flex-1]:text-[var(--ink-faint)] [&_span.flex-1]:line-through" : ""}>
      <Bullet
        entry={entry}
        size="sm"
        glyphSlot={
          <button
            type="button"
            className={toggleable ? "cursor-pointer" : "cursor-default"}
            disabled={!toggleable}
            title={entry.status === "DONE" ? "reabrir" : toggleable ? "concluir" : migrated ? "migrada" : undefined}
            onClick={(e) => { e.stopPropagation(); ops?.toggle(entry); }}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {glyph(entry)}
          </button>
        }
        suffix={<Badges entry={entry} />}
      >
        {actions}
      </Bullet>
    </div>
  );
}

export function EntryRow({ entry, place, ops, actions }: { entry: EntryDto; place: Place; ops: RowOps; actions?: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const clickTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    data: { place },
    // Só raiz aberta sai do lugar; as demais continuam alvo (soltar antes delas).
    disabled: { draggable: !canMove(entry) || editing, droppable: false },
  });

  const onKeyDown = (e: KeyboardEvent<HTMLLIElement>) => {
    listeners?.onKeyDown?.(e);
    if (e.defaultPrevented || isDragging || e.target !== e.currentTarget) return;
    if (e.key === "Enter") ops.open(entry.id);
  };

  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      aria-roledescription="tarefa arrastável"
      // A linha tem controles próprios (marcador, edição): "não arrasta" não é "desabilitada".
      aria-disabled={undefined}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : undefined, WebkitTouchCallout: "none" }}
      className="-mx-1 rounded px-1 outline-none focus-visible:bg-[var(--paper-raised)] focus-visible:ring-1 focus-visible:ring-[var(--line)]"
    >
      {editing ? (
        <div className="flex items-baseline gap-[11px]">
          <span className="w-3.5 flex-none text-sm">{glyph(entry)}</span>
          <InlineEdit value={entry.text} onSave={(t) => ops.rename(entry, t)} onDone={() => setEditing(false)} className="text-base" />
        </div>
      ) : (
        <div
          className="cursor-pointer select-none"
          onClick={() => {
            // Clique abre o painel, a menos que venha o segundo clique (edição).
            window.clearTimeout(clickTimer.current);
            clickTimer.current = window.setTimeout(() => ops.open(entry.id), 250);
          }}
          onDoubleClick={() => {
            window.clearTimeout(clickTimer.current);
            setEditing(true);
          }}
        >
          <EntryView entry={entry} ops={ops} actions={actions} />
        </div>
      )}
    </li>
  );
}
