import type { ReactNode } from "react";
import type { HabitDayDto } from "@indice/shared";

export function Card({ title, children, aside }: { title?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card">
      {(title || aside) && (
        <div className="mb-3 flex items-baseline justify-between">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wide muted">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "yellow" | "red" }) {
  return (
    <div>
      <div className="text-xs muted">{label}</div>
      <div className="mono text-xl font-semibold" style={tone ? { color: `var(--${tone})` } : undefined}>{value}</div>
    </div>
  );
}

export function Progress({ pct, color }: { pct: number; color?: string | null }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--line)" }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color ?? "var(--accent)" }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm muted">{children}</p>;
}

export function Pill({ children, tone }: { children: ReactNode; tone: "green" | "yellow" | "red" }) {
  return <span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ background: `var(--${tone})` }}>{children}</span>;
}

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
