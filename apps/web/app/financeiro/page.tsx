import { getAccounts, getInvoices, getTransactions, brl, dateBR } from "@/lib/api";
import { addTransaction } from "@/lib/actions";
import { Card, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Financeiro() {
  const [{ accounts, unassigned }, { invoices }, { transactions }] = await Promise.all([getAccounts(), getInvoices(), getTransactions("?limit=50")]);
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-4">
        <Card title="Lançamento rápido">
          <form action={addTransaction} className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
            <select name="type" className="rounded border bg-transparent px-2 py-1" style={{ borderColor: "var(--line)" }}>
              <option value="EXPENSE">Saída</option><option value="INCOME">Entrada</option><option value="INVESTMENT">Aporte</option>
            </select>
            <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded border bg-transparent px-2 py-1" style={{ borderColor: "var(--line)" }} />
            <input name="amount" type="number" step="0.01" min="0.01" required placeholder="0,00" className="rounded border bg-transparent px-2 py-1" style={{ borderColor: "var(--line)" }} />
            <input name="description" placeholder="descrição" className="col-span-2 rounded border bg-transparent px-2 py-1" style={{ borderColor: "var(--line)" }} />
            <button className="rounded px-3 py-1 text-white" style={{ background: "var(--accent)" }}>Lançar</button>
          </form>
        </Card>
        <Card title="Últimos lançamentos">
          <table className="w-full text-sm">
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="mono py-1 text-xs muted">{dateBR(t.date)}</td>
                  <td className="py-1">{t.description || t.categoryName || t.type}</td>
                  <td className="py-1 text-xs muted">{t.categoryName ?? ""}{t.installmentNo ? ` ${t.installmentNo}/${t.installmentTotal}` : ""}</td>
                  <td className={`mono py-1 text-right ${t.type === "INCOME" ? "" : "muted"}`}>{t.type === "INCOME" ? "+" : "−"}{brl(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!transactions.length && <Empty>Sem lançamentos.</Empty>}
        </Card>
      </div>
      <div className="grid gap-4 content-start">
        <Card title="Contas">
          {accounts.map((a) => <div key={a.id} className="flex justify-between text-sm"><span>{a.name} <span className="muted text-xs">{a.institution ?? a.kind.toLowerCase()}</span></span><span className="mono">{brl(a.balance)}</span></div>)}
          {unassigned !== 0 && <div className="mt-1 flex justify-between text-xs muted"><span>Não informado</span><span className="mono">{brl(unassigned)}</span></div>}
          {!accounts.length && <Empty>Nenhuma conta.</Empty>}
        </Card>
        <Card title="Faturas">
          {invoices.slice(0, 6).map((i) => <div key={i.id} className="flex justify-between text-sm"><span>{i.institution} {String(i.refMonth).padStart(2, "0")}/{i.refYear} <span className="muted text-xs">{i.status.toLowerCase()}</span></span><span className="mono">{brl(i.total)}</span></div>)}
          {!invoices.length && <Empty>Nenhuma fatura.</Empty>}
        </Card>
      </div>
    </div>
  );
}
