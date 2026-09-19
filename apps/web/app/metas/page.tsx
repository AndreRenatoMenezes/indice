import { getGoals, getGoal, brl, dateBR, GOAL_KIND_LABEL } from "@/lib/api";
import { addGoal, addGoalContribution, setGoalTarget, updateGoal } from "@/lib/actions";
import { Card, Empty, Progress } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "ativa", PAUSED: "pausada", ACHIEVED: "alcançada", ABANDONED: "abandonada" };
const fmt = (kind: string, v: number, unit: string | null) => (kind === "FINANCIAL" ? brl(v) : `${v}${unit ? ` ${unit}` : kind === "HABIT" ? "%" : ""}`);

export default async function Metas() {
  const { goals } = await getGoals();
  const details = await Promise.all(goals.map((g) => getGoal(g.id)));
  const active = goals.filter((g) => g.status === "ACTIVE").length;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-4">
        <div className="text-xs muted">{active} ativa{active === 1 ? "" : "s"}</div>
        {details.map((g) => (
          <Card key={g.id} title={g.title} aside={<span className="text-xs muted">{GOAL_KIND_LABEL[g.kind]} · prioridade {details.indexOf(g) + 1} · {STATUS_LABEL[g.status]}</span>}>
            {g.description && <p className="mb-2 text-sm muted">{g.description}</p>}
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="mono text-lg font-semibold">{fmt(g.kind, g.currentValue, g.unit)}</span>
              <span className="muted">de {fmt(g.kind, g.targetValue, g.unit)} · {g.progressPct.toFixed(2)}%</span>
            </div>
            <Progress pct={g.progressPct} color={g.color} />
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div><dt className="text-xs muted">Faltam</dt><dd className="mono">{g.daysRemaining == null ? "—" : `${g.daysRemaining} dias`}</dd></div>
              <div><dt className="text-xs muted">Necessário por mês</dt><dd className="mono">{g.requiredMonthly == null ? "—" : fmt(g.kind, g.requiredMonthly, g.unit)}</dd></div>
              <div><dt className="text-xs muted">Ritmo atual</dt><dd className="mono" style={g.paceMonthly != null && g.requiredMonthly != null ? { color: g.paceMonthly >= g.requiredMonthly ? "var(--green)" : "var(--red)" } : undefined}>{g.paceMonthly == null ? "—" : `${fmt(g.kind, g.paceMonthly, g.unit)}/mês`}</dd></div>
              <div><dt className="text-xs muted">Projeção no ritmo</dt><dd className="mono">{dateBR(g.projectedDate)}</dd></div>
            </dl>
            <div className="mt-1 text-xs muted">início {dateBR(g.startDate)} · prazo {dateBR(g.targetDate)}</div>

            {g.milestones.length > 0 && (
              <div className="mt-3">
                <div className="text-xs uppercase tracking-wide muted">Marcos</div>
                {g.milestones.map((m) => <div key={m.id} className="flex justify-between py-1 text-sm"><span className={m.achievedAt ? "line-through muted" : ""}>{m.title}</span><span className="mono muted text-xs">{m.targetValue != null ? fmt(g.kind, m.targetValue, g.unit) : ""}{m.targetDate ? ` · até ${dateBR(m.targetDate)}` : ""}</span></div>)}
              </div>
            )}

            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide muted">Aportes</div>
              {g.contributions.slice(-5).reverse().map((c) => <div key={c.id} className="flex justify-between py-1 text-sm"><span><span className="mono text-xs muted">{dateBR(c.date)}</span> {c.note ?? (c.transactionId ? "via lançamento" : "manual")}</span><span className="mono">{c.amount >= 0 ? "+" : ""}{fmt(g.kind, c.amount, g.unit)}</span></div>)}
              {!g.contributions.length && <Empty>Nenhum aporte ainda.</Empty>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <form action={addGoalContribution.bind(null, g.id)} className="flex flex-1 gap-2 text-sm">
                <input name="amount" type="number" step="0.01" required placeholder="aporte" className="input w-28" />
                <input name="date" type="date" className="input" aria-label="data" />
                <input name="note" placeholder="nota" className="input flex-1" />
                <button className="btn btn-primary">Registrar</button>
              </form>
              <a href={`${apiBase}/goals/${g.id}/export?format=csv`} className="text-xs underline muted">CSV</a>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <form action={setGoalTarget.bind(null, g.id)} className="flex gap-1"><input name="targetValue" type="number" step="0.01" min="0" defaultValue={g.targetValue} className="input w-32" aria-label="alvo" /><button className="btn">Ajustar alvo</button></form>
              {g.status === "ACTIVE" && <form action={updateGoal.bind(null, g.id, { status: "PAUSED" })}><button className="btn">Pausar</button></form>}
              {g.status !== "ACTIVE" && <form action={updateGoal.bind(null, g.id, { status: "ACTIVE" })}><button className="btn">Reativar</button></form>}
              {g.status !== "ACHIEVED" && <form action={updateGoal.bind(null, g.id, { status: "ACHIEVED" })}><button className="btn">Alcançada</button></form>}
            </div>
          </Card>
        ))}
        {!goals.length && <Empty>Nenhuma meta.</Empty>}
      </div>

      <div className="grid gap-4 content-start">
        <Card title="Nova meta">
          <form action={addGoal} className="grid gap-2 text-sm">
            <input name="title" required placeholder="título" className="input" />
            <select name="kind" className="input" defaultValue="FINANCIAL">
              <option value="FINANCIAL">financeira (R$)</option><option value="NUMERIC">numérica (unidades)</option><option value="HABIT">de hábito (%)</option><option value="MILESTONE">por marcos</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input name="targetValue" type="number" step="0.01" min="0" required placeholder="alvo" className="input" />
              <input name="unit" placeholder="unidade (livros, km)" className="input" />
            </div>
            <label className="grid gap-1 text-xs muted">prazo<input name="targetDate" type="date" className="input" /></label>
            <input name="priority" type="number" min="0" max="9" placeholder="prioridade (maior = primeiro)" className="input" />
            <textarea name="description" placeholder="descrição" className="input" rows={2} />
            <button className="btn btn-primary">Criar</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
