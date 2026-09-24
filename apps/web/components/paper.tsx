// Camada de página do caderno: o que os três templates do design system
// ("Registro Diário", "Spread Semanal", "Coleção") repetem literalmente.
// Os componentes de `ui.tsx` são as peças; estes são a folha onde elas pousam.
import type { ReactNode } from "react";
import type { EntryDto } from "@indice/shared";
import { INK } from "./palette";
import { SketchLine } from "./sketch";

/** Rótulo de seção: serifada em caixa alta espaçada, o ar editorial do caderno. */
export function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`label tracking-[0.22em] ${className}`}>{children}</div>;
}

/**
 * Cabeçalho de página: sobrenome da seção, título em serifada itálica e o bloco
 * de contexto à direita, fechados pela régua desenhada.
 */
export function PageHead({ eyebrow, title, meta, sub, size = 44, children }: {
  eyebrow: string;
  title: ReactNode;
  meta?: ReactNode;
  sub?: ReactNode;
  /** 46px no Registro Diário, 44px nas outras páginas. */
  size?: 44 | 46;
  /** Controles opcionais (navegação de semana) ao lado do bloco da direita. */
  children?: ReactNode;
}) {
  return (
    <header className="mb-2.5">
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div>
          <div className="label mb-1.5 tracking-[0.24em] text-[var(--ink-soft)]">{eyebrow}</div>
          <h1 className="m-0 font-display italic leading-none tracking-[-0.01em]" style={{ fontSize: size }}>{title}</h1>
        </div>
        <div className="flex items-end gap-4 text-right leading-[1.35]">
          <div>
            {meta && <div className="text-[19px]">{meta}</div>}
            {sub && <div className="label mt-1 text-[var(--ink-soft)]">{sub}</div>}
          </div>
          {children}
        </div>
      </div>
      <SketchLine stroke={INK} />
    </header>
  );
}

// Signifiers do método: concluído (✕), tarefa (•), evento (○), nota (—),
// migrado (›), agendado (‹). Cancelado não ganha glifo — só o riscado.
function glyphOf(e: Pick<EntryDto, "kind" | "status">): { glyph: string; tone?: string } {
  switch (e.status) {
    case "DONE": return { glyph: "✕", tone: "var(--green)" };
    case "MIGRATED": return { glyph: "›", tone: "var(--ink-soft)" };
    case "SCHEDULED": return { glyph: "‹", tone: "var(--ink-soft)" };
    case "CANCELLED": return { glyph: "", tone: "var(--ink-soft)" };
    default: return e.kind === "EVENT" ? { glyph: "○", tone: "var(--ink-soft)" }
      : e.kind === "NOTE" ? { glyph: "—", tone: "var(--ink-soft)" }
      : { glyph: "•" };
  }
}

/**
 * Uma linha do registro. Os `<form>` de concluir/apagar continuam por fora:
 * aqui só mora a aparência do bullet.
 */
export function Bullet({ entry, size = "lg", glyphSlot, suffix, children }: {
  entry: Pick<EntryDto, "kind" | "status" | "text" | "time">;
  /** "lg" no Registro Diário (18px), "sm" nas colunas do spread (16px). */
  size?: "lg" | "sm";
  /** Substitui o glifo por um controle (o botão de concluir). */
  glyphSlot?: ReactNode;
  /** Canto direito: hora, "migrado", contadores. */
  suffix?: ReactNode;
  /** Ações que aparecem no hover da linha. */
  children?: ReactNode;
}) {
  const { glyph, tone } = glyphOf(entry);
  const done = entry.status === "DONE" || entry.status === "CANCELLED";
  const lg = size === "lg";
  return (
    <div className={`group flex items-baseline ${lg ? "gap-3.5" : "gap-[11px]"}`}>
      <span className={`flex-none ${lg ? "w-4 text-[15px]" : "w-3.5 text-sm"}`} style={{ color: tone }}>
        {glyphSlot ?? glyph}
      </span>
      <span
        className={`flex-1 ${lg ? "text-[18px]" : "text-base"} ${done ? "muted line-through decoration-[var(--ink-faint)]" : ""} ${entry.kind === "NOTE" && !done ? "muted italic" : ""}`}
      >
        {entry.text}
      </span>
      {entry.time && <span className="label tracking-[0.16em] text-[var(--ink-faint)]">{entry.time}</span>}
      {suffix}
      {children}
    </div>
  );
}

/** A frase de fechamento da página — voz do caderno, não dado da API. */
export function Quote({ children }: { children: ReactNode }) {
  return <p className="m-0 max-w-[46ch] font-display text-[19px] italic leading-[1.55] muted text-pretty">{children}</p>;
}
