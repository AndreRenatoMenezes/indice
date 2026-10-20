"use client";

// ‹ hoje › e o calendário em popover. "Hoje" é a semana sem `?date=` (a API
// decide o dia); fecha com Esc e com clique fora.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addDays } from "@/lib/dates";
import { Sketch } from "../sketch";
import { MiniCalendar } from "./MiniCalendar";

export function WeekNav({ viewed, today }: { viewed: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);

  return (
    <div ref={box} className="relative pb-1">
      <nav aria-label="Semana" className="flex items-baseline gap-3 text-[19px]">
        <Link href={`/semana?date=${addDays(viewed, -7)}`} title="semana anterior" aria-label="semana anterior">‹</Link>
        <Link href="/semana" className="label tracking-[0.18em] text-[var(--accent)]" title="semana de hoje">hoje</Link>
        <Link href={`/semana?date=${addDays(viewed, 7)}`} title="próxima semana" aria-label="próxima semana">›</Link>
        <button
          type="button"
          className="cursor-pointer text-[17px] text-[var(--ink-soft)]"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="escolher data no calendário"
          title="calendário"
          onClick={() => setOpen((o) => !o)}
        >
          ▦
        </button>
      </nav>
      {open && (
        <div role="dialog" aria-label="calendário" className="absolute right-0 top-full z-40 mt-2 px-4 py-3">
          <Sketch radius={10} fill="var(--card)" />
          <div className="relative">
            <MiniCalendar
              viewed={viewed}
              today={today}
              onPick={(d) => { setOpen(false); router.push(`/semana?date=${d}`); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
