import { getDailySummary, brl, dateBR } from "@/lib/api";
import { capitalize, isoWeek, monthName, weekdayName, year } from "@/lib/dates";
import { addEntry, deleteEntry, logHabit, migrateEntry, toggleEntry, upsertDailyLog } from "@/lib/actions";
import { Btn, Card, Empty, Field, Frame, Pill, Progress, SketchLine, Stat, WeekDots } from "@/components/ui";
import { Bullet, PageHead, Quote, SectionLabel } from "@/components/paper";

export const dynamic = "force-dynamic";

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
  const entries = s.journal.entries;
  const doneEntries = entries.filter((e) => e.status === "DONE").length;
  const streak = s.habits.reduce((max, h) => Math.max(max, h.streak), 0);
  const goal = s.goals[0];
  // "Coleções" do caderno: as tags que os bullets do dia carregam. Não há rota
  // de collections na API, então nada de pills inventadas.
  const tags = [...new Set(entries.flatMap((e) => e.tags))];

  return (
    <>
      <PageHead
        size={46}
        eyebrow="Índice · diário"
        title={capitalize(monthName(s.date))}
        meta={`${weekdayName(s.date)}, ${dateBR(s.date).slice(0, 5)}`}
        sub={`semana ${isoWeek(s.date)} · ${year(s.date)}`}
      >
        <Pill tone={f.trafficLight.status}>{f.trafficLight.label}</Pill>
      </PageHead>

      <div className="mt-8 grid items-start gap-12 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <main className="flex min-w-0 flex-col gap-8">
          <section>
            <SectionLabel className="mb-3.5">Registro do dia</SectionLabel>
            <ul className="flex flex-col gap-3">
              {entries.map((e) => (
                <li key={e.id}>
                  <Bullet
                    entry={e}
                    glyphSlot={
                      <form action={toggleEntry.bind(null, e.id, e.status !== "DONE")}>
                        <button className="cursor-pointer" title={e.status === "DONE" ? "reabrir" : "concluir"}>
                          {e.status === "DONE" ? "✕" : e.kind === "EVENT" ? "○" : e.kind === "NOTE" ? "—" : "•"}
                        </button>
                      </form>
                    }
                    suffix={
                      <>
                        {e.priority > 0 && <span className="text-xs">{"*".repeat(e.priority)}</span>}
                        {e.children?.length ? <span className="text-xs muted">{e.children.filter((c) => c.status === "DONE").length}/{e.children.length}</span> : null}
                      </>
                    }
                  >
                    <form action={deleteEntry.bind(null, e.id)} className="opacity-0 group-hover:opacity-100">
                      <button className="label tracking-[0.16em] text-[var(--ink-faint)]" title="apagar">apagar</button>
                    </form>
                  </Bullet>
                </li>
              ))}
              {!entries.length && <Empty>Nada registrado ainda.</Empty>}
            </ul>

            <form action={addEntry} className="mt-5 flex gap-2">
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
              <div className="mt-7">
                <SectionLabel className="mb-3.5">De dias anteriores</SectionLabel>
                <ul className="flex flex-col gap-2.5">
                  {s.journal.carriedOver.map((e) => (
                    <li key={e.id} className="flex items-center gap-3">
                      <span className="label w-14 flex-none tracking-[0.16em] text-[var(--ink-faint)]">{dateBR(e.date).slice(0, 5)}</span>
                      <span className="flex-1 text-[17px]">{e.text}</span>
                      <form action={migrateEntry.bind(null, e.id, s.date)}><Btn className="text-xs">migrar ›</Btn></form>
                      <form action={toggleEntry.bind(null, e.id, true)}><Btn className="text-xs">concluir</Btn></form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section>
            <SectionLabel className="mb-3.5">Hábitos da semana</SectionLabel>
            <div className="flex flex-col gap-4">
              {s.habits.map((h) => (
                <div key={h.habit.id} className={`flex items-center justify-between gap-6 ${!h.scheduledToday ? "opacity-50" : ""}`}>
                  <form action={logHabit.bind(null, h.habit.id, !h.done, s.date)}>
                    <button className="cursor-pointer text-left text-[17px]" title={h.done ? "desmarcar hoje" : "marcar hoje"}>
                      {h.habit.name}
                    </button>
                  </form>
                  <WeekDots week={h.week} />
                </div>
              ))}
              {!s.habits.length && <Empty>Nenhum hábito. Crie em Hábitos.</Empty>}
            </div>
            <div className="mt-5 opacity-50"><SketchLine stroke="var(--ink-soft)" /></div>
          </section>

          <Quote>O caderno não cobra nada de você — ele só guarda o que você decidiu lembrar.</Quote>
        </main>

        <aside className="flex min-w-0 flex-col gap-5">
          <div className="grid grid-cols-2 gap-3.5">
            <Stat label="Sequência" value={`${streak} ${streak === 1 ? "dia" : "dias"}`} />
            <Stat label="Concluídas" value={`${doneEntries} / ${entries.length}`} tone="green" />
          </div>

          {goal && (
            <Card title="Meta do mês">
              <div className="flex items-baseline justify-between">
                <span className="text-[17px] muted">{goal.title}</span>
                <span className="mono text-[17px]">{goal.progressPct.toFixed(0)}%</span>
              </div>
              <Progress pct={goal.progressPct} color={goal.color} />
              <div className="label tracking-[0.18em] text-[var(--ink-faint)]">
                {goal.targetDate ? `até ${dateBR(goal.targetDate)}${goal.daysRemaining != null ? ` · ${goal.daysRemaining} dias` : ""}` : "sem prazo"}
              </div>
            </Card>
          )}

          {tags.length > 0 && (
            <Card title="Coleções">
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => <Pill key={t} tone="gray">{t}</Pill>)}
              </div>
            </Card>
          )}

          <div>
            <SectionLabel className="mb-3">Captura rápida</SectionLabel>
            <form action={addEntry} className="flex items-center gap-2.5">
              <input type="hidden" name="date" value={s.date} />
              <input type="hidden" name="kind" value="NOTE" />
              <Field name="text" placeholder="anotar…" required frameClassName="flex-1" />
              <Btn tone="primary">somar</Btn>
            </form>
          </div>

          <Card title="Diário do dia">
            <form action={upsertDailyLog} className="flex flex-wrap items-end gap-3 text-sm">
              <input type="hidden" name="date" value={s.date} />
              <label className="label grid gap-1">acordei às<Field name="wokeAt" type="time" defaultValue={log?.wokeAt ?? ""} /></label>
              <label className="label grid gap-1">humor 1–5<Field name="mood" type="number" min={1} max={5} defaultValue={log?.mood ?? ""} frameClassName="w-20" /></label>
              <label className="label grid gap-1">energia 1–5<Field name="energy" type="number" min={1} max={5} defaultValue={log?.energy ?? ""} frameClassName="w-20" /></label>
              <label className="label grid gap-1">sono (h)<Field name="sleepHours" type="number" step="0.5" min={0} max={24} defaultValue={log?.sleepHours ?? ""} frameClassName="w-24" /></label>
              <label className="label grid flex-1 gap-1">destaque<Field name="highlights" defaultValue={log?.highlights ?? ""} placeholder="o que marcou o dia" /></label>
              <Btn>Salvar</Btn>
            </form>
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

          <Card tone="yellow" title={`Financeiro · ${capitalize(monthName(`${f.month.year}-${String(f.month.month).padStart(2, "0")}-01`))}`} aside={<span className="label text-[var(--ink-faint)]">{f.daysRemaining} dias</span>}>
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
        </aside>
      </div>
    </>
  );
}
