"use client";

// Repetição no painel, com as opções do WeekToDo (repeatingEvent.vue): não
// repete, todo dia, toda semana, dias úteis, dias escolhidos, todo mês, dias do
// mês, todo ano; intervalo; termina nunca / após N vezes / numa data. A regra
// não se edita: com repetição, o painel mostra o resumo e "parar de repetir".
import { useState } from "react";
import type { RecurrenceInput, RecurrenceRuleDto } from "@indice/shared";
import { isoWeekday } from "@/lib/dates";

type Mode = "none" | "daily" | "weekly" | "weekdays" | "someWeekdays" | "monthly" | "someMonthDays" | "yearly";

const MODES: [Mode, string][] = [
  ["none", "não repete"], ["daily", "todo dia"], ["weekly", "toda semana"], ["weekdays", "dias úteis"],
  ["someWeekdays", "dias escolhidos"], ["monthly", "todo mês"], ["someMonthDays", "dias do mês"], ["yearly", "todo ano"],
];
const UNIT: Partial<Record<Mode, [string, string]>> = {
  daily: ["dia", "dias"], weekly: ["semana", "semanas"], someWeekdays: ["semana", "semanas"],
  monthly: ["mês", "meses"], someMonthDays: ["mês", "meses"], yearly: ["ano", "anos"],
};
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

const box = "input rounded border border-[var(--rule-soft)] px-2 py-0.5";

function Toggle({ on, children, onClick, label }: { on: boolean; children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} onClick={onClick}
      className={`mono min-w-8 cursor-pointer rounded border px-1.5 py-0.5 text-[13px] ${on ? "border-[var(--fg)] bg-[var(--paper-raised)]" : "border-[var(--rule-soft)] text-[var(--muted)]"}`}>
      {children}
    </button>
  );
}

export function RecurrencePicker({ date, rule, onSet, onStop }: {
  /** Dia da tarefa: a primeira ocorrência. */
  date: string;
  rule?: RecurrenceRuleDto;
  onSet: (input: RecurrenceInput, label: string) => void;
  onStop: (rule: RecurrenceRuleDto) => void;
}) {
  const [mode, setMode] = useState<Mode>("none");
  const [every, setEvery] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>([isoWeekday(date)]);
  const [monthDays, setMonthDays] = useState<number[]>([Number(date.slice(8, 10))]);
  const [end, setEnd] = useState<"never" | "count" | "until">("never");
  const [count, setCount] = useState(10);
  const [until, setUntil] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (rule) {
    return (
      <div>
        <div className="label mb-1.5">Repetição</div>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-[15px]">↻ {rule.summary}</span>
          {confirming ? (
            <span className="flex items-baseline gap-2 text-[14px]">
              parar? as futuras abertas somem
              <button type="button" className="cursor-pointer text-[var(--red)] underline" onClick={() => { setConfirming(false); onStop(rule); }}>sim</button>
              <button type="button" className="cursor-pointer underline" onClick={() => setConfirming(false)}>não</button>
            </span>
          ) : (
            <button type="button" className="cursor-pointer text-[14px] text-[var(--red)] underline decoration-dotted underline-offset-4" onClick={() => setConfirming(true)}>
              parar de repetir
            </button>
          )}
        </div>
      </div>
    );
  }

  const toggle = (list: number[], v: number) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort((a, b) => a - b));
  const unit = UNIT[mode];
  const invalid =
    (mode === "someWeekdays" && !weekdays.length) || (mode === "someMonthDays" && !monthDays.length) ||
    (end === "until" && (!until || until < date)) || (end === "count" && !(count >= 1 && count <= 999));

  const submit = () => {
    if (mode === "none" || invalid) return;
    const freq = ({ daily: "DAILY", weekly: "WEEKLY", someWeekdays: "WEEKLY", weekdays: "WEEKDAYS", monthly: "MONTHLY", someMonthDays: "MONTHLY", yearly: "YEARLY" } as const)[mode];
    const input: RecurrenceInput = {
      freq,
      interval: mode === "weekdays" ? 1 : Math.min(99, Math.max(1, every)),
      ...(mode === "someWeekdays" ? { weekdays } : {}),
      ...(mode === "someMonthDays" ? { monthDays } : {}),
      end: end === "count" ? { type: "count", count } : end === "until" ? { type: "until", date: until } : { type: "never" },
    };
    onSet(input, MODES.find(([m]) => m === mode)![1]);
    setMode("none");
  };

  return (
    <div>
      <div className="label mb-1.5">Repetição</div>
      <div className="flex flex-col gap-2">
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} aria-label="repetir" className={`${box} w-full`}>
          {MODES.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
        </select>

        {mode !== "none" && (
          <>
            {unit && (
              <label className="flex items-center gap-2 text-[14px]">
                a cada
                <input type="number" min={1} max={99} value={every} onChange={(e) => setEvery(Number(e.target.value) || 1)} aria-label="intervalo" className={`${box} w-16`} />
                {every === 1 ? unit[0] : unit[1]}
              </label>
            )}
            {mode === "someWeekdays" && (
              <div className="flex flex-wrap gap-1" role="group" aria-label="dias da semana">
                {WEEKDAYS.map((w, i) => <Toggle key={w} on={weekdays.includes(i + 1)} onClick={() => setWeekdays(toggle(weekdays, i + 1))} label={w}>{w}</Toggle>)}
              </div>
            )}
            {mode === "someMonthDays" && (
              <div className="grid grid-cols-7 gap-1" role="group" aria-label="dias do mês">
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <Toggle key={d} on={monthDays.includes(d)} onClick={() => setMonthDays(toggle(monthDays, d))} label={`dia ${d}`}>{d}</Toggle>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 text-[14px]">
              termina
              <select value={end} onChange={(e) => setEnd(e.target.value as typeof end)} aria-label="termina" className={box}>
                <option value="never">nunca</option>
                <option value="count">após</option>
                <option value="until">em</option>
              </select>
              {end === "count" && (
                <>
                  <input type="number" min={1} max={999} value={count} onChange={(e) => setCount(Number(e.target.value))} aria-label="vezes" className={`${box} w-16`} />
                  vezes
                </>
              )}
              {end === "until" && <input type="date" min={date} value={until} onChange={(e) => setUntil(e.target.value)} aria-label="até" className={box} />}
            </div>
            <button type="button" disabled={invalid} onClick={submit}
              className="cursor-pointer self-start rounded border border-[var(--fg)] px-3 py-0.5 text-[14px] disabled:cursor-default disabled:opacity-40">
              repetir
            </button>
          </>
        )}
      </div>
    </div>
  );
}
