import { getGoals, getGoal, brl, dateBR, GOAL_KIND_LABEL } from "@/lib/api";
import { addGoal, addGoalContribution, setGoalTarget, updateGoal } from "@/lib/actions";
import { Btn, Card, Empty, Field, Frame, Progress } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = { ACTIVE: "ativa", PAUSED: "pausada", ACHIEVED: "alcançada", ABANDONED: "abandonada" };
const fmt = (kind: string, v: number, unit: string | null) => (kind === "FINANCIAL" ? brl(v) : `${v}${unit ? ` ${unit}` : kind === "HABIT" ? "%" : ""}`);

export default async function Metas() {
  const { goals } = await getGoals();
  const details = await Promise.all(goals.map((g) => getGoal(g.id)));
  const active = goals.filter((g) => g.status === "ACTIVE").length;
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-6">
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
                <Field name="amount" type="number" step="0.01" required placeholder="aporte" frameClassName="w-28" />
                <Field name="date" type="date" aria-label="data" />
                <Field name="note" placeholder="nota" frameClassName="flex-1" />
                <Btn tone="primary">Registrar</Btn>
              </form>
              <a href={`${apiBase}/goals/${g.id}/export?format=csv`} className="text-xs underline muted">CSV</a>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <form action={setGoalTarget.bind(null, g.id)} className="flex gap-1"><Field name="targetValue" type="number" step="0.01" min="0" defaultValue={g.targetValue} aria-label="alvo" frameClassName="w-32" /><Btn>Ajustar alvo</Btn></form>
              {g.status === "ACTIVE" && <form action={updateGoal.bind(null, g.id, { status: "PAUSED" })}><Btn>Pausar</Btn></form>}
              {g.status !== "ACTIVE" && <form action={updateGoal.bind(null, g.id, { status: "ACTIVE" })}><Btn>Reativar</Btn></form>}
              {g.status !== "ACHIEVED" && <form action={updateGoal.bind(null, g.id, { status: "ACHIEVED" })}><Btn>Alcançada</Btn></form>}
            </div>
          </Card>
        ))}
        {!goals.length && <Empty>Nenhuma meta.</Empty>}
      </div>

      <div className="grid gap-6 content-start">
        <Card title="Nova meta">
          <form action={addGoal} className="grid gap-2 text-sm">
            <Field name="title" required placeholder="título" />
            <Frame><select name="kind" className="input w-full" defaultValue="FINANCIAL">
              <option value="FINANCIAL">financeira (R$)</option><option value="NUMERIC">numérica (unidades)</option><option value="HABIT">de hábito (%)</option><option value="MILESTONE">por marcos</option>
            </select></Frame>
            <div className="grid grid-cols-2 gap-2">
              <Field name="targetValue" type="number" step="0.01" min="0" required placeholder="alvo" />
              <Field name="unit" placeholder="unidade (livros, km)" />
            </div>
            <label className="grid gap-1 text-xs muted">prazo<Field name="targetDate" type="date" /></label>
            <Field name="priority" type="number" min="0" max="9" placeholder="prioridade (maior = primeiro)" />
            <Frame><textarea name="description" placeholder="descrição" className="input w-full" rows={2} /></Frame>
            <Btn tone="primary">Criar</Btn>
          </form>
        </Card>
      </div>
    </div>
  );
}
