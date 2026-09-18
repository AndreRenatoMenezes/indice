import { getGoals, brl, dateBR } from "@/lib/api";
import { addGoalContribution } from "@/lib/actions";
import { Card, Empty, Progress } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Metas() {
  const { goals } = await getGoals();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {goals.map((g) => (
        <Card key={g.id} title={g.title} aside={<span className="text-xs muted">{g.status.toLowerCase()}</span>}>
          <Progress pct={g.progressPct} color={g.color} />
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt className="muted">Progresso</dt><dd className="mono">{brl(g.currentValue)} / {brl(g.targetValue)} ({g.progressPct.toFixed(1)}%)</dd>
            <dt className="muted">Prazo</dt><dd className="mono">{dateBR(g.targetDate)}{g.daysRemaining != null && ` · ${g.daysRemaining}d`}</dd>
            <dt className="muted">Necessário/mês</dt><dd className="mono">{g.requiredMonthly == null ? "—" : brl(g.requiredMonthly)}</dd>
            <dt className="muted">Ritmo atual/mês</dt><dd className="mono">{g.paceMonthly == null ? "—" : brl(g.paceMonthly)}</dd>
            <dt className="muted">Projeção</dt><dd className="mono">{dateBR(g.projectedDate)}</dd>
          </dl>
          <form action={addGoalContribution.bind(null, g.id)} className="mt-3 flex gap-2 text-sm">
            <input name="amount" type="number" step="0.01" required placeholder="aporte" className="w-32 rounded border bg-transparent px-2 py-1" style={{ borderColor: "var(--line)" }} />
            <input name="note" placeholder="nota" className="flex-1 rounded border bg-transparent px-2 py-1" style={{ borderColor: "var(--line)" }} />
            <button className="rounded px-3 py-1 text-white" style={{ background: "var(--accent)" }}>Registrar</button>
          </form>
          <a href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"}/goals/${g.id}/export?format=csv`} className="mt-2 inline-block text-xs underline muted">exportar CSV</a>
        </Card>
      ))}
      {!goals.length && <Empty>Nenhuma meta.</Empty>}
    </div>
  );
}
