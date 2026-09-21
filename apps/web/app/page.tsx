import { getDailySummary, brl, dateBR, habitSubline } from "@/lib/api";
import { addEntry, deleteEntry, logHabit, migrateEntry, toggleEntry, upsertDailyLog } from "@/lib/actions";
import { Btn, Card, Empty, Field, Frame, Pill, Progress, SketchLine, Stat } from "@/components/ui";
import { PALETTE } from "@/components/palette";
import { Sketch } from "@/components/sketch";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];
const GLYPH: Record<string, string> = { TASK: "•", EVENT: "○", NOTE: "–" };

export default async function Today({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  let s;
  try {
    s = await getDailySummary(date);
  } catch (e) {
    return <Card title="API indisponível"><Empty>{String((e as Error).message)}</Empty></Card>;
  }
  const f = s.finance;
  const log = s.journal.log;
  const doneHabits = s.habits.filter((h) => h.done).length;
  const scheduled = s.habits.filter((h) => h.scheduledToday).length;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-6">
        <Card title={`Hoje · ${dateBR(s.date)} · ${WEEKDAYS[s.weekday]}`} aside={<Pill tone={f.trafficLight.status}>{f.trafficLight.label}</Pill>}>
          <ul className="space-y-1">
            {s.journal.entries.map((e, i) => (
              <li key={e.id} className="group relative flex items-center gap-2 text-sm">
                {i > 0 && <SketchLine strokeWidth={0.8} stroke={PALETTE.gray[1]} className="absolute -top-1 left-0 right-0" />}
                <form action={toggleEntry.bind(null, e.id, e.status !== "DONE")}>
                  <button className="mono w-5 text-left" title={e.status === "DONE" ? "reabrir" : "concluir"}>{e.status === "DONE" ? "×" : GLYPH[e.kind]}</button>
                </form>
                <span className={e.status === "DONE" ? "line-through muted" : ""}>{e.text}</span>
                {e.time && <span className="mono text-xs muted">{e.time}</span>}
                {e.priority > 0 && <span className="text-xs">{"*".repeat(e.priority)}</span>}
                {e.children?.length ? <span className="text-xs muted">{e.children.filter((c) => c.status === "DONE").length}/{e.children.length}</span> : null}
                <form action={deleteEntry.bind(null, e.id)} className="ml-auto opacity-0 group-hover:opacity-100"><button className="text-xs muted" title="apagar">apagar</button></form>
              </li>
            ))}
            {!s.journal.entries.length && <Empty>Nada registrado ainda.</Empty>}
          </ul>
          <form action={addEntry} className="mt-3 flex gap-2">
            <input type="hidden" name="date" value={s.date} />
            <Frame>
              <select name="kind" className="input" aria-label="tipo">
                <option value="TASK">• tarefa</option><option value="EVENT">○ evento</option><option value="NOTE">– nota</option>
              </select>
            </Frame>
            <Field name="text" placeholder="novo bullet" required frameClassName="flex-1" />
            <Field name="time" type="time" aria-label="hora" />
            <Btn tone="primary">Adicionar</Btn>
          </form>
          {s.journal.carriedOver.length > 0 && (
            <div className="mt-4">
              <div className="text-xs muted mb-1">De dias anteriores</div>
              <ul className="space-y-1">
                {s.journal.carriedOver.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="mono text-xs muted">{dateBR(e.date)}</span>
                    <span className="flex-1">{e.text}</span>
                    <form action={migrateEntry.bind(null, e.id, s.date)}><Btn className="text-xs">migrar →</Btn></form>
                    <form action={toggleEntry.bind(null, e.id, true)}><Btn className="text-xs">concluir</Btn></form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Hábitos" aside={<span className="text-xs muted">{doneHabits} de {scheduled} hoje</span>}>
          <ul className="grid gap-2 sm:grid-cols-3">
            {s.habits.map((h) => (
              <li key={h.habit.id} className={`relative p-2 text-sm ${!h.scheduledToday ? "opacity-50" : ""}`}>
                <Sketch radius={8} strokeWidth={1.2} fill={h.done ? PALETTE.green[0] : undefined} />
                <form action={logHabit.bind(null, h.habit.id, !h.done, s.date)} className="relative">
                  <button className="w-full cursor-pointer text-left">
                    <div className="flex items-center justify-between">
                      <span>{h.done ? "✓" : "○"} {h.habit.name}</span>
                      <span className="mono text-xs muted">{h.streak}d</span>
                    </div>
                    <div className="mt-1 text-xs muted">
                      {h.log && h.habit.kind === "TIME" ? `${String(Math.floor(h.log.value / 60)).padStart(2, "0")}:${String(h.log.value % 60).padStart(2, "0")} hoje` : h.log && h.habit.kind !== "BOOLEAN" ? `${h.log.value} ${h.habit.unit ?? ""} hoje` : habitSubline(h.habit)}
                    </div>
                  </button>
                </form>
              </li>
            ))}
            {!s.habits.length && <Empty>Nenhum hábito. Crie em Hábitos.</Empty>}
          </ul>
        </Card>

        <Card title="Diário do dia">
          <form action={upsertDailyLog} className="flex flex-wrap items-end gap-3 text-sm">
            <input type="hidden" name="date" value={s.date} />
            <label className="grid gap-1 text-xs muted">acordei às<Field name="wokeAt" type="time" defaultValue={log?.wokeAt ?? ""} /></label>
            <label className="grid gap-1 text-xs muted">humor 1–5<Field name="mood" type="number" min={1} max={5} defaultValue={log?.mood ?? ""} frameClassName="w-20" /></label>
            <label className="grid gap-1 text-xs muted">energia 1–5<Field name="energy" type="number" min={1} max={5} defaultValue={log?.energy ?? ""} frameClassName="w-20" /></label>
            <label className="grid gap-1 text-xs muted">sono (h)<Field name="sleepHours" type="number" step="0.5" min={0} max={24} defaultValue={log?.sleepHours ?? ""} frameClassName="w-24" /></label>
            <label className="grid flex-1 gap-1 text-xs muted">destaque<Field name="highlights" defaultValue={log?.highlights ?? ""} placeholder="o que marcou o dia" /></label>
            <Btn>Salvar</Btn>
          </form>
        </Card>
      </div>

      <div className="grid gap-6 content-start">
        <Card tone="yellow" title={`Financeiro · ${new Date(f.month.year, f.month.month - 1, 1).toLocaleDateString("pt-BR", { month: "long" })}`} aside={<span className="text-xs muted">{f.daysRemaining} dias restantes</span>}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Saldo do mês" value={brl(f.balance)} tone={f.balance < 0 ? "red" : undefined} />
            <Stat label="Por dia" value={brl(f.dailyBudget)} tone={f.trafficLight.status} />
            <Stat label="Gasto hoje" value={brl(f.spentToday)} />
            <Stat label="Dias p/ salário" value={f.daysToSalary == null ? "—" : String(f.daysToSalary)} />
          </div>
          <p className="mt-2 text-xs muted">{f.trafficLight.message}</p>
          {(f.invoicesDueSoon.length > 0 || f.billsDueSoon.length > 0) && (
            <ul className="mt-3 space-y-1 text-xs">
              {f.invoicesDueSoon.map((i) => <li key={i.id} className="flex justify-between"><span>Fatura {i.institution} · vence {dateBR(i.dueDate)}</span><span className="mono">{brl(i.total)}</span></li>)}
              {f.billsDueSoon.map((b) => <li key={b.id} className="flex justify-between"><span>{b.name}{b.dueDay ? ` · dia ${b.dueDay}` : ""}</span><span className="mono">{brl(b.amount)}</span></li>)}
            </ul>
          )}
        </Card>

        <Card title="Metas">
          {s.goals.map((g) => (
            <div key={g.id} className="mb-3">
              <div className="flex justify-between text-sm"><span>{g.title}</span><span className="mono muted">{g.progressPct.toFixed(1)}%</span></div>
              <Progress pct={g.progressPct} color={g.color} />
              <div className="mt-1 flex justify-between text-xs muted">
                <span>{g.targetDate ? `até ${dateBR(g.targetDate)}${g.daysRemaining != null ? ` · ${g.daysRemaining} dias` : ""}` : "sem prazo"}</span>
                {g.requiredMonthly != null && <span className="mono">{brl(g.requiredMonthly)}/mês</span>}
              </div>
            </div>
          ))}
          {!s.goals.length && <Empty>Nenhuma meta ativa.</Empty>}
        </Card>

        <Card title="Em andamento">
          {s.media.map((m) => (
            <div key={m.id} className="mb-2 text-sm">
              <div className="flex justify-between"><span>{m.title}</span>{m.progress != null && m.progressTotal ? <span className="mono text-xs muted">{m.progress}/{m.progressTotal} {m.progressUnit ?? ""}</span> : null}</div>
              {m.progress != null && m.progressTotal ? <Progress pct={(m.progress / m.progressTotal) * 100} /> : null}
            </div>
          ))}
          {!s.media.length && <Empty>Nada em andamento.</Empty>}
        </Card>
      </div>
    </div>
  );
}
