"use client";

// Calendário mensal para saltar de semana (a barra lateral do WeekToDo):
// destaca a semana vista e o dia de hoje; clicar num dia abre a semana dele.
import { useState } from "react";
import { addMonths, capitalize, dayOfMonth, firstOfMonth, monthGrid, monthName, year } from "@/lib/dates";

const HEAD = ["S", "T", "Q", "Q", "S", "S", "D"];

export function MiniCalendar({ viewed, today, onPick }: {
  /** Um dia da semana vista. */
  viewed: string;
  /** "Hoje" no fuso da API. */
  today: string;
  onPick: (date: string) => void;
}) {
  const [month, setMonth] = useState(firstOfMonth(viewed));
  const weeks = monthGrid(month);
  const inMonth = (d: string) => d.slice(0, 7) === month.slice(0, 7);

  return (
    <div className="w-[272px] select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="btn px-2 text-[19px]" aria-label="mês anterior" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
        <span className="font-display text-[17px]" aria-live="polite">{capitalize(monthName(month))} {year(month)}</span>
        <button type="button" className="btn px-2 text-[19px]" aria-label="próximo mês" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      </div>
      <table className="w-full border-collapse text-center" role="grid">
        <thead>
          <tr>{HEAD.map((h, i) => <th key={i} className="label pb-1 font-normal tracking-[0.1em]">{h}</th>)}</tr>
        </thead>
        <tbody>
          {weeks.map((week) => {
            const current = week.includes(viewed);
            return (
              <tr key={week[0]} className={current ? "bg-[var(--paper-raised)]" : ""}>
                {week.map((d) => (
                  <td key={d} className="p-0">
                    <button
                      type="button"
                      onClick={() => onPick(d)}
                      aria-label={d.split("-").reverse().join("/")}
                      aria-current={d === today ? "date" : undefined}
                      className={`mono h-8 w-full cursor-pointer rounded text-[14px] hover:bg-[var(--rule-soft)] ${inMonth(d) ? "" : "text-[var(--ink-faint)]"} ${d === today ? "font-bold text-[var(--accent)] underline decoration-2 underline-offset-4" : ""}`}
                    >
                      {Number(dayOfMonth(d))}
                    </button>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
