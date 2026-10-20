"use client";

// Lateral: pendentes de dias passados da semana vista, com "migrar todas para
// hoje" (atrasadas só andam por ação explícita), e "limpar migradas" para
// tirar os rastros › quando a semana fica poluída.
import type { EntryDto } from "@indice/shared";
import { dateBR } from "@/lib/api";
import { SectionLabel } from "../paper";
import { Empty } from "../ui";

export function PendingAside({ pending, traces, onOpen, onMigrateAll, onClearTraces }: {
  pending: EntryDto[];
  /** Quantas migradas (›) há na semana vista. */
  traces: number;
  onOpen: (id: string) => void;
  onMigrateAll: () => void;
  onClearTraces: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Pendentes</SectionLabel>
      {pending.length ? (
        <>
          <ul className="flex flex-col gap-2.5">
            {pending.map((e) => (
              <li key={e.id}>
                <button type="button" onClick={() => onOpen(e.id)} className="flex w-full cursor-pointer items-baseline gap-3 text-left">
                  <span className="label tracking-[0.16em] text-[var(--ink-faint)]">{dateBR(e.date).slice(0, 5)}</span>
                  <span className="flex-1 text-base">{e.text}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={onMigrateAll} className="cursor-pointer self-start text-[15px] text-[var(--accent)] underline decoration-dotted underline-offset-4">
            migrar todas para hoje ›
          </button>
        </>
      ) : (
        <Empty>Nada pendente por aqui.</Empty>
      )}
      {traces > 0 && (
        <button type="button" onClick={onClearTraces} className="cursor-pointer self-start text-[14px] text-[var(--ink-soft)] underline decoration-dotted underline-offset-4">
          limpar migradas desta semana ({traces})
        </button>
      )}
    </div>
  );
}
