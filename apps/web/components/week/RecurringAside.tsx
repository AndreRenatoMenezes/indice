"use client";

// Lateral: as tarefas repetidas (o RecurrentEventsModal do WeekToDo), com o
// resumo da regra e "parar", que pede confirmação e tira da tela as futuras.
import { useState } from "react";
import type { RecurrenceRuleDto } from "@indice/shared";
import { SectionLabel } from "../paper";

export function RecurringAside({ rules, onStop }: { rules: RecurrenceRuleDto[]; onStop: (rule: RecurrenceRuleDto) => void }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!rules.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Repetidas</SectionLabel>
      <ul className="flex flex-col gap-2.5">
        {rules.map((r) => (
          <li key={r.id} className="flex flex-col">
            <span className="text-base">↻ {r.text}</span>
            <span className="flex flex-wrap items-baseline gap-2 text-[13px] text-[var(--ink-soft)]">
              {r.summary}
              {confirming === r.id ? (
                <span className="flex items-baseline gap-2">
                  · parar? as futuras abertas somem
                  <button type="button" className="cursor-pointer text-[var(--red)] underline" onClick={() => { setConfirming(null); onStop(r); }}>sim</button>
                  <button type="button" className="cursor-pointer underline" onClick={() => setConfirming(null)}>não</button>
                </span>
              ) : (
                <button type="button" aria-label={`parar de repetir ${r.text}`} className="cursor-pointer underline decoration-dotted underline-offset-4" onClick={() => setConfirming(r.id)}>
                  parar
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
