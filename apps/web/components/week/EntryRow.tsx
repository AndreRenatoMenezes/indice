"use client";

// Uma tarefa na semana: o bullet do caderno com o marcador clicável (concluir /
// reabrir), clique que abre o painel, duplo clique que edita ali mesmo e os
// selos (hora, cor, prioridade, subtarefas, nota, repetição).
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { EntryDto } from "@indice/shared";
import { Bullet } from "../paper";

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
        else if (e.key === "Escape") finish(false);
      }}
      onBlur={() => finish(true)}
      onClick={(e) => e.stopPropagation()}
      className={`input w-full border-b border-[var(--line)] px-0 ${className}`}
      aria-label="editar texto"
    />
  );
}

export function EntryRow({ entry, ops, actions }: { entry: EntryDto; ops: RowOps; actions?: ReactNode }) {
  const [editing, setEditing] = useState(false);
  const clickTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);

  const toggleable = entry.status === "OPEN" || entry.status === "DONE";
  const migrated = entry.status === "MIGRATED";

  if (editing) {
    return (
      <div className="flex items-baseline gap-[11px]">
        <span className="w-3.5 flex-none text-sm">{glyph(entry)}</span>
        <InlineEdit value={entry.text} onSave={(t) => ops.rename(entry, t)} onDone={() => setEditing(false)} className="text-base" />
      </div>
    );
  }

  return (
    <div
      className={`cursor-pointer select-none ${migrated ? "[&_span.flex-1]:text-[var(--ink-faint)] [&_span.flex-1]:line-through" : ""}`}
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
      <Bullet
        entry={entry}
        size="sm"
        glyphSlot={
          <button
            type="button"
            className={toggleable ? "cursor-pointer" : "cursor-default"}
            disabled={!toggleable}
            title={entry.status === "DONE" ? "reabrir" : toggleable ? "concluir" : migrated ? "migrada" : undefined}
            onClick={(e) => { e.stopPropagation(); ops.toggle(entry); }}
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
