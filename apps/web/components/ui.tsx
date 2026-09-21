import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { HabitDayDto } from "@indice/shared";
import { MUTED, PALETTE, type Tone } from "./palette";
import { Sketch, SketchLine, type SketchProps } from "./sketch";

/** Caixa com moldura desenhada à mão em volta de conteúdo arbitrário. */
export function Frame({ children, className = "", ...sketch }: SketchProps & { children: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <Sketch radius={6} strokeWidth={1} {...sketch} />
      <span className="relative flex w-full items-center">{children}</span>
    </span>
  );
}

export function Card({ title, children, aside, tone }: { title?: string; children: ReactNode; aside?: ReactNode; tone?: Tone }) {
  return (
    <section className="relative flex flex-col gap-[10px] px-5 py-5">
      <Sketch radius={10} fill={tone ? PALETTE[tone][0] : undefined} />
      {(title || aside) && (
        <div className="relative flex items-baseline justify-between">
          {title && <h2 className="text-[13px] uppercase tracking-[0.04em] muted">{title}</h2>}
          {aside}
        </div>
      )}
      <div className="relative flex flex-col gap-[10px]">{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] muted">{label}</div>
      <div className="mono text-2xl leading-[1.15]" style={tone ? { color: PALETTE[tone][1] } : undefined}>{value}</div>
    </div>
  );
}

export function Progress({ pct, color }: { pct: number; color?: string | null }) {
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="relative h-3 w-full">
      <Sketch radius={3} strokeWidth={1.2} />
      {clamped > 0 && (
        <div className="absolute inset-y-0 left-0" style={{ width: `${clamped}%` }}>
          <Sketch radius={0} strokeWidth={1} roughness={0.6} stroke={color ?? PALETTE.green[1]} fill={color ?? PALETTE.green[1]} fillStyle="hachure" />
        </div>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm muted">{children}</p>;
}

export function Pill({ children, tone }: { children: ReactNode; tone: Tone }) {
  return (
    <span className="relative inline-flex h-[30px] items-center justify-center whitespace-nowrap px-4 text-sm">
      <Sketch radius={15} strokeWidth={1.1} fill={PALETTE[tone][0]} />
      <span className="relative">{children}</span>
    </span>
  );
}

export function Btn({ tone, className = "", frameClassName = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost"; frameClassName?: string }) {
  return (
    <span className={`relative inline-flex ${frameClassName}`}>
      <Sketch
        radius={6}
        strokeWidth={tone === "primary" ? 1.3 : 1}
        fill={tone === "primary" ? PALETTE.green[0] : undefined}
        stroke={tone === "ghost" ? MUTED : undefined}
        dash={tone === "ghost"}
        single={tone === "ghost"}
      />
      <button {...props} className={`btn relative w-full ${className}`}>{children}</button>
    </span>
  );
}

export function Field({ className = "", frameClassName = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { frameClassName?: string }) {
  return (
    <Frame className={frameClassName} stroke={MUTED} dash single>
      <input {...props} className={`input w-full ${className}`} />
    </Frame>
  );
}

export { SketchLine };

// Régua semanal de um hábito: segunda a domingo.
const DAY_LETTERS = ["S", "T", "Q", "Q", "S", "S", "D"];
export function WeekDots({ week }: { week: HabitDayDto[] }) {
  return (
    <div className="flex gap-2">
      {week.map((d, i) => (
        <div key={d.date} className="flex flex-col items-center gap-0.5" title={`${d.date} · ${d.status}`}>
          <span className="text-[10px] muted">{DAY_LETTERS[i]}</span>
          <span className={`dot dot-${d.status}`} />
        </div>
      ))}
    </div>
  );
}
