"use client";

// Menu "⋯" do cabeçalho de um dia ou lista (o listHeader do WeekToDo).
// Fecha com Esc, com clique fora e depois de escolher.
import { useEffect, useRef, useState } from "react";
import { Sketch } from "../sketch";

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean };

export function ColumnMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); setOpen(false); } };
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`ações de ${label}`}
        onClick={() => setOpen((o) => !o)}
        className="cursor-pointer px-1 text-[15px] leading-none text-[var(--ink-faint)] hover:text-[var(--fg)]"
      >
        ⋯
      </button>
      {open && (
        <div role="menu" aria-label={`ações de ${label}`} className="absolute right-0 top-full z-30 mt-1.5 min-w-[220px] px-1.5 py-1.5">
          <Sketch radius={8} fill="var(--card)" />
          <div className="relative flex flex-col">
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onSelect(); }}
                className={`cursor-pointer rounded px-2.5 py-1.5 text-left text-[15px] normal-case tracking-normal hover:bg-[var(--paper-raised)] disabled:cursor-default disabled:opacity-40 ${it.danger ? "text-[var(--red)]" : "text-[var(--fg)]"}`}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
