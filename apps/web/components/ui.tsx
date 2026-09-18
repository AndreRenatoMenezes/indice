import type { ReactNode } from "react";

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
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color ?? "var(--accent)" }} />
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm muted">{children}</p>;
}
