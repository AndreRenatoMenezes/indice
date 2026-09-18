import { getDailySummary, brl, dateBR } from "@/lib/api";
import { addEntry, logHabit, migrateEntry, toggleEntry } from "@/lib/actions";
import { Card, Empty, Progress, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["", "segunda", "terça", "quarta", "quinta", "sexta", "sábado", "domingo"];

export default async function Today({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  let s;
  try {
    s = await getDailySummary(date);
  } catch (e) {
    return <Card title="API indisponível"><Empty>{String((e as Error).message)}</Empty></Card>;
  }
  const f = s.finance;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-4">
        <Card title={`Hoje · ${dateBR(s.date)} · ${WEEKDAYS[s.weekday]}`}>
          <ul className="space-y-1">
            {s.journal.entries.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <form action={toggleEntry.bind(null, e.id, e.status !== "DONE")}>
                  <button className="mono w-5 text-left" title={e.status}>{e.status === "DONE" ? "×" : e.kind === "EVENT" ? "○" : e.kind === "NOTE" ? "–" : "•"}</button>
                </form>
                <span className={e.status === "DONE" ? "line-through muted" : ""}>{e.text}</span>
                {e.time && <span className="mono text-xs muted">{e.time}</span>}
                {e.priority > 0 && <span className="text-xs">{"*".repeat(e.priority)}</span>}
              </li>
            ))}
            {!s.journal.entries.length && <Empty>Nada registrado ainda.</Empty>}
          </ul>
          <form action={addEntry} className="mt-3 flex gap-2">
            <input type="hidden" name="date" value={s.date} />
            <input name="text" placeholder="• novo bullet" className="flex-1 rounded border bg-transparent px-2 py-1 text-sm" style={{ borderColor: "var(--line)" }} />
            <button className="rounded px-3 py-1 text-sm text-white" style={{ background: "var(--accent)" }}>Adicionar</button>
          </form>
          {s.journal.carriedOver.length > 0 && (
            <div className="mt-4">
              <div className="text-xs muted mb-1">Pendentes de dias anteriores</div>
              <ul className="space-y-1">
                {s.journal.carriedOver.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 text-sm">
                    <span className="mono text-xs muted">{dateBR(e.date)}</span>
                    <span>{e.text}</span>
                    <form action={migrateEntry.bind(null, e.id, s.date)}><button className="text-xs underline muted">migrar →</button></form>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Hábitos">
          <ul className="grid gap-2 sm:grid-cols-3">
            {s.habits.map((h) => (
              <li key={h.habit.id} className={`rounded border p-2 text-sm ${!h.scheduledToday ? "opacity-50" : ""}`} style={{ borderColor: "var(--line)" }}>
                <form action={logHabit.bind(null, h.habit.id, !h.done, s.date)}>
                  <button className="flex w-full items-center justify-between">
                    <span>{h.done ? "✓" : "○"} {h.habit.name}</span>
                    <span className="mono text-xs muted">{h.streak}d</span>
                  </button>
                </form>
              </li>
            ))}
            {!s.habits.length && <Empty>Nenhum hábito. Rode o seed ou crie via API.</Empty>}
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 content-start">
        <Card title="Financeiro" aside={<span className="rounded-full px-2 py-0.5 text-xs text-white" style={{ background: `var(--${f.trafficLight.status})` }}>{f.trafficLight.label}</span>}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Saldo do mês" value={brl(f.balance)} tone={f.balance < 0 ? "red" : undefined} />
            <Stat label="Por dia" value={brl(f.dailyBudget)} />
            <Stat label="Gasto hoje" value={brl(f.spentToday)} />
            <Stat label="Dias p/ salário" value={f.daysToSalary == null ? "—" : String(f.daysToSalary)} />
          </div>
          <p className="mt-2 text-xs muted">{f.trafficLight.message}</p>
          {f.invoicesDueSoon.length > 0 && (
            <ul className="mt-3 text-xs">
              {f.invoicesDueSoon.map((i) => <li key={i.id} className="flex justify-between"><span>Fatura {i.institution} · {dateBR(i.dueDate)}</span><span className="mono">{brl(i.total)}</span></li>)}
            </ul>
          )}
        </Card>

        <Card title="Metas">
          {s.goals.map((g) => (
            <div key={g.id} className="mb-3">
              <div className="flex justify-between text-sm"><span>{g.title}</span><span className="mono muted">{g.progressPct.toFixed(1)}%</span></div>
              <Progress pct={g.progressPct} color={g.color} />
              <div className="mt-1 text-xs muted">{g.targetDate ? `até ${dateBR(g.targetDate)}` : "sem prazo"}{g.requiredMonthly != null && ` · ${brl(g.requiredMonthly)}/mês`}</div>
            </div>
          ))}
          {!s.goals.length && <Empty>Nenhuma meta ativa.</Empty>}
        </Card>

        <Card title="Em andamento">
          {s.media.map((m) => (
            <div key={m.id} className="text-sm">{m.title} <span className="muted text-xs">{m.kind.toLowerCase()}{m.progress != null && m.progressTotal ? ` · ${m.progress}/${m.progressTotal}` : ""}</span></div>
          ))}
          {!s.media.length && <Empty>Nada em andamento.</Empty>}
        </Card>
      </div>
    </div>
  );
}
