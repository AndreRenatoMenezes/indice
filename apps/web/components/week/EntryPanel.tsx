"use client";

// Painel de detalhes (o toDoModal do WeekToDo): gaveta à direita no desktop,
// tela cheia no celular. Cada campo grava ao mudar ou ao sair dele, e a linha
// na semana acompanha na hora (estado otimista do WeekBoard).
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { CustomListDto, EntryDto, UpdateEntryInput } from "@indice/shared";
import { dateBR } from "@/lib/api";
import { capitalize, weekdayName, weekdayShort, dayOfMonth } from "@/lib/dates";
import { PALETTE } from "../palette";
import { glyph } from "./EntryRow";
import { Notes } from "./Notes";
import { canMove, parsePlaceKey, placeKey, samePlace, type Place } from "./weekState";

export type GoalOption = { id: string; title: string };

export type PanelOps = {
  update: (e: EntryDto, patch: UpdateEntryInput) => void;
  moveTo: (e: EntryDto, from: Place, to: Place) => void;
  duplicate: (e: EntryDto, place: Place) => void;
  copy: (e: EntryDto) => void;
  remove: (e: EntryDto, place: Place) => void;
  /** Ocorrência repetida: "esta e as próximas" = parar a regra + apagar esta. */
  removeSeries: (e: EntryDto, place: Place) => void;
  close: () => void;
};

const KINDS = [["TASK", "• tarefa"], ["EVENT", "○ evento"], ["NOTE", "— nota"]] as const;
const COLORS = Object.entries(PALETTE).map(([name, [, strong]]) => [name, strong] as const);

/** Campo de texto com rascunho: grava ao sair ou com Enter; Esc desfaz. */
function DraftInput({ value, onSave, allowEmpty = false, ...props }: {
  value: string;
  onSave: (v: string) => void;
  allowEmpty?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);
  const commit = () => {
    const t = draft.trim();
    if (!t && !allowEmpty) return setDraft(value);
    if (t !== value) onSave(t);
  };
  return (
    <input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) e.currentTarget.blur();
        if (e.key === "Escape") { e.preventDefault(); setDraft(value); setTimeout(() => (e.target as HTMLInputElement).blur()); }
      }}
    />
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3">
      <span className="label">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, children, ...props }: { active?: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={`cursor-pointer rounded border px-2 py-0.5 text-[14px] ${active ? "border-[var(--fg)] bg-[var(--paper-raised)]" : "border-[var(--rule-soft)] text-[var(--muted)] hover:border-[var(--line)]"} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function placeLabel(place: Place, lists: CustomListDto[]): string {
  if (place.kind === "list") return lists.find((l) => l.id === place.id)?.name ?? "lista";
  return `${capitalize(weekdayName(place.date))}, ${dateBR(place.date).slice(0, 5)}`;
}

export function EntryPanel({ entry, place, days, lists, goals, ops, subtasks, recurrence }: {
  entry: EntryDto;
  place: Place;
  /** Dias da semana vista (destinos rápidos de "mover para"). */
  days: string[];
  lists: CustomListDto[];
  goals: GoalOption[];
  ops: PanelOps;
  /** Seções que outras partes do quadro montam (subtarefas, repetição). */
  subtasks?: ReactNode;
  recurrence?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [otherDate, setOtherDate] = useState("");
  const [askSeries, setAskSeries] = useState(false);
  const movable = canMove(entry);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) ops.close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ops]);
  useEffect(() => { root.current?.focus(); }, [entry.id]);

  const set = (patch: UpdateEntryInput) => ops.update(entry, patch);
  const destinations: { key: string; label: string }[] = [
    ...days.map((d) => ({ key: placeKey({ kind: "day", date: d }), label: `${weekdayShort(d)} ${dayOfMonth(d)}` })),
    ...lists.map((l) => ({ key: placeKey({ kind: "list", id: l.id }), label: l.name })),
  ].filter((d) => d.key !== placeKey(place));

  return (
    <div
      ref={root}
      tabIndex={-1}
      role="dialog"
      aria-label="detalhes da tarefa"
      className="fixed inset-0 z-40 overflow-y-auto bg-[var(--card)] px-6 pb-10 pt-5 outline-none md:inset-y-0 md:left-auto md:right-0 md:w-[420px] md:border-l md:border-[var(--line)] md:shadow-[-6px_0_24px_rgba(34,31,28,0.08)]"
    >
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <span className="label">{placeLabel(place, lists)}{entry.status === "MIGRATED" ? " · migrada" : entry.status === "DONE" ? " · concluída" : ""}</span>
        <button type="button" onClick={ops.close} aria-label="fechar painel" className="cursor-pointer text-[22px] leading-none text-[var(--ink-soft)]">×</button>
      </div>

      <div className="mb-5 flex items-baseline gap-3">
        <span className="w-4 flex-none text-[18px] text-[var(--ink-soft)]">{glyph(entry)}</span>
        <DraftInput value={entry.text} onSave={(text) => set({ text })} aria-label="texto da tarefa" className="input w-full border-b border-[var(--rule-soft)] px-0 font-display text-[22px] focus:border-[var(--line)]" />
      </div>

      <div className="flex flex-col gap-3.5">
        <Row label="Tipo">
          {KINDS.map(([k, label]) => <Chip key={k} active={entry.kind === k} onClick={() => entry.kind !== k && set({ kind: k })}>{label}</Chip>)}
        </Row>

        <Row label="Hora">
          <DraftInput
            type="time"
            value={entry.time ?? ""}
            allowEmpty
            onSave={(v) => set({ time: v || null })}
            aria-label="hora"
            className="input rounded border border-[var(--rule-soft)] px-2 py-0.5"
          />
          {entry.time && <Chip onClick={() => set({ time: null })}>sem hora</Chip>}
        </Row>

        <Row label="Cor">
          <button type="button" aria-label="sem cor" aria-pressed={!entry.color} onClick={() => entry.color && set({ color: null })}
            className={`h-5 w-5 cursor-pointer rounded-full border border-dashed border-[var(--line)] ${!entry.color ? "ring-2 ring-[var(--fg)] ring-offset-1" : ""}`} />
          {COLORS.map(([name, hex]) => (
            <button key={name} type="button" aria-label={`cor ${name}`} aria-pressed={entry.color === hex} onClick={() => entry.color !== hex && set({ color: hex })}
              className={`h-5 w-5 cursor-pointer rounded-full ${entry.color === hex ? "ring-2 ring-[var(--fg)] ring-offset-1" : ""}`} style={{ background: hex }} />
          ))}
        </Row>

        <Row label="Prioridade">
          {[0, 1, 2, 3].map((p) => (
            <Chip key={p} active={entry.priority === p} onClick={() => entry.priority !== p && set({ priority: p })} aria-label={`prioridade ${p}`}>
              {p === 0 ? "—" : <span className="text-[var(--red)]">{"*".repeat(p)}</span>}
            </Chip>
          ))}
        </Row>

        <Row label="Tags">
          <DraftInput
            value={entry.tags.join(", ")}
            allowEmpty
            onSave={(v) => {
              const tags = [...new Set(v.split(",").map((t) => t.trim()).filter(Boolean))];
              if (tags.join(",") !== entry.tags.join(",")) set({ tags });
            }}
            placeholder="casa, trabalho"
            aria-label="tags"
            className="input w-full rounded border border-[var(--rule-soft)] px-2 py-0.5"
          />
        </Row>

        <Row label="Meta">
          <select
            value={entry.goalId ?? ""}
            onChange={(e) => set({ goalId: e.target.value || null })}
            aria-label="meta vinculada"
            className="input w-full rounded border border-[var(--rule-soft)] px-2 py-0.5"
          >
            <option value="">sem meta</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </Row>

        <div>
          <div className="label mb-1.5">Notas</div>
          <Notes value={entry.description} onSave={(description) => set({ description })} />
        </div>

        {subtasks}
        {recurrence}

        <Row label="Mover para">
          {movable ? (
            <>
              <select
                value=""
                onChange={(e) => { const to = parsePlaceKey(e.target.value); if (to && !samePlace(to, place)) ops.moveTo(entry, place, to); }}
                aria-label="mover para"
                className="input w-full rounded border border-[var(--rule-soft)] px-2 py-0.5"
              >
                <option value="">escolher…</option>
                {destinations.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              <input type="date" value={otherDate} onChange={(e) => setOtherDate(e.target.value)} aria-label="outra data" className="input min-w-0 flex-1 rounded border border-[var(--rule-soft)] px-2 py-0.5" />
              <Chip disabled={!otherDate} onClick={() => { if (otherDate) ops.moveTo(entry, place, { kind: "day", date: otherDate }); setOtherDate(""); }}>ir</Chip>
            </>
          ) : (
            <span className="text-sm muted">Só tarefa aberta muda de lugar; reabra para mover.</span>
          )}
        </Row>
      </div>

      <div className="mt-7 flex flex-wrap gap-2 border-t border-[var(--rule-soft)] pt-4">
        <Chip onClick={() => ops.duplicate(entry, place)}>duplicar</Chip>
        <Chip onClick={() => ops.copy(entry)}>copiar texto</Chip>
        {askSeries ? (
          <span className="flex flex-wrap items-center gap-2 text-[14px]">
            apagar:
            <Chip onClick={() => ops.remove(entry, place)} className="text-[var(--red)]">só esta</Chip>
            <Chip onClick={() => ops.removeSeries(entry, place)} className="text-[var(--red)]">esta e as próximas</Chip>
            <Chip onClick={() => setAskSeries(false)}>cancelar</Chip>
          </span>
        ) : (
          <Chip onClick={() => (entry.recurrenceRuleId ? setAskSeries(true) : ops.remove(entry, place))} className="text-[var(--red)]">apagar</Chip>
        )}
      </div>
    </div>
  );
}
