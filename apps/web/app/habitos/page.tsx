import { getHabitsToday, dateBR, habitSubline } from "@/lib/api";
import { addHabit, logHabit, logHabitValue } from "@/lib/actions";
import { Card, Empty, Pill, Progress, WeekDots } from "@/components/ui";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { BOOLEAN: "feito / não feito", COUNTER: "contagem", DURATION: "duração", TIME: "horário" };
const DAYS = [[1, "seg"], [2, "ter"], [3, "qua"], [4, "qui"], [5, "sex"], [6, "sáb"], [7, "dom"]] as const;
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export default async function Habitos({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: q } = await searchParams;
  const { date, habits } = await getHabitsToday(q);
  const scheduled = habits.filter((h) => h.scheduledToday);
  const done = scheduled.filter((h) => h.done).length;
  const week = habits[0]?.week;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-4">
        <Card title={week ? `Hábitos · semana ${dateBR(week[0]!.date)} – ${dateBR(week[6]!.date)}` : "Hábitos"} aside={<Pill tone={done === scheduled.length && scheduled.length > 0 ? "green" : done > 0 ? "yellow" : "red"}>{done} de {scheduled.length} hoje</Pill>}>
          <ul className="grid gap-3">
            {habits.map((h) => (
              <li key={h.habit.id} className="rounded border p-3 text-sm" style={{ borderColor: "var(--line)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-medium">{h.habit.name}</div>
                    <div className="text-xs muted">{habitSubline(h.habit)} · {KIND_LABEL[h.habit.kind]}</div>
                    {h.log && <div className="mt-1 text-xs">{h.habit.kind === "TIME" ? `hoje às ${hhmm(h.log.value)}` : h.habit.kind === "BOOLEAN" ? "feito hoje" : `hoje: ${h.log.value} ${h.habit.unit ?? ""}`}{h.log.note ? ` · ${h.log.note}` : ""}</div>}
                  </div>
                  <div className="text-right">
                    <div className="mono text-lg font-semibold">{h.streak}</div>
                    <div className="text-[10px] uppercase muted">sequência</div>
                  </div>
                  <form action={logHabit.bind(null, h.habit.id, !h.done, date)}>
                    <button className="btn h-10 w-10 rounded-full text-lg" style={h.done ? { background: "var(--green)", borderColor: "var(--green)", color: "white" } : undefined} title={h.done ? "desmarcar" : "marcar como feito"}>{h.done ? "✓" : "○"}</button>
                  </form>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <WeekDots week={h.week} />
                  {h.habit.kind !== "BOOLEAN" && (
                    <form action={logHabitValue} className="flex items-center gap-1 text-xs">
                      <input type="hidden" name="habitId" value={h.habit.id} />
                      <input type="hidden" name="date" value={date} />
                      {h.habit.kind === "TIME"
                        ? <input name="time" type="time" required className="input" aria-label="horário" />
                        : <input name="value" type="number" step="any" min="0" required placeholder={h.habit.unit ?? "valor"} className="input w-24" aria-label="valor" />}
                      <button className="btn">Registrar</button>
                    </form>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs muted"><span className="w-28">30 dias · {h.consistency30}%</span><div className="flex-1"><Progress pct={h.consistency30} color={h.consistency30 >= 80 ? "var(--green)" : h.consistency30 >= 50 ? "var(--yellow)" : "var(--red)"} /></div></div>
              </li>
            ))}
          </ul>
          {!habits.length && <Empty>Nenhum hábito cadastrado.</Empty>}
        </Card>
      </div>

      <div className="grid gap-4 content-start">
        <Card title="Novo hábito">
          <form action={addHabit} className="grid gap-2 text-sm">
            <input name="name" required placeholder="nome" className="input" />
            <select name="kind" className="input" defaultValue="BOOLEAN">
              <option value="BOOLEAN">feito / não feito</option><option value="COUNTER">contagem (copos, km)</option><option value="DURATION">duração (min)</option><option value="TIME">horário-limite (acordar até)</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input name="targetValue" type="number" step="any" min="0" placeholder="meta (contagem/duração)" className="input" />
              <input name="unit" placeholder="unidade (min, copos)" className="input" />
            </div>
            <label className="grid gap-1 text-xs muted">horário-limite (TIME)<input name="targetTime" type="time" className="input" /></label>
            <fieldset className="flex flex-wrap gap-2 text-xs">
              {DAYS.map(([n, l]) => <label key={n} className="flex items-center gap-1"><input type="checkbox" name="weekdays" value={n} defaultChecked /> {l}</label>)}
            </fieldset>
            <button className="btn btn-primary">Criar</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
