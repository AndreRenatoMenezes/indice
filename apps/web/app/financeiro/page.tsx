import { getAccounts, getCategories, getDailySummary, getInstitutions, getInvoices, getTransactions, brl, dateBR, shortDate, txSubline, TX_LABEL } from "@/lib/api";
import { addTransaction, deleteTransaction, payInvoice } from "@/lib/actions";
import { Btn, Card, Empty, Field, Frame, Pill, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { CHECKING: "corrente", SAVINGS: "poupança", PAYMENT: "pagamento", CASH: "dinheiro", INVESTMENT: "investimento" };

export default async function Financeiro() {
  const [summary, { accounts, unassigned }, { categories }, { institutions }, { invoices }, { transactions }] = await Promise.all([
    getDailySummary(), getAccounts(), getCategories(), getInstitutions(), getInvoices(), getTransactions("?limit=60"),
  ]);
  const f = summary.finance;
  const cards = institutions.flatMap((i) => i.cards.map((c) => ({ ...c, institution: i.name })));
  const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];
  const byKind = (kind: string) => categories.filter((c) => c.kind === kind && !c.system);
  const monthName = new Date(f.month.year, f.month.month - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-6">
        <Card title={`Financeiro · ${monthName}`} aside={<Pill tone={f.trafficLight.status}>{f.trafficLight.label}</Pill>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Saldo do mês" value={brl(f.balance)} tone={f.balance < 0 ? "red" : undefined} />
            <Stat label="Por dia" value={brl(f.dailyBudget)} tone={f.trafficLight.status} />
            <Stat label="Gasto hoje" value={brl(f.spentToday)} />
            <Stat label="Contas abertas" value={brl(f.openBills)} />
          </div>
          <div className="mt-2 flex justify-between text-xs muted"><span>{f.trafficLight.message}</span><span>{f.daysRemaining} dias restantes</span></div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-xs muted">
            <span>Entradas <b className="mono">{brl(f.totalIncome)}</b></span>
            <span>Saídas <b className="mono">{brl(f.totalExpense)}</b></span>
            <span>Aportes <b className="mono">{brl(f.totalInvestment)}</b></span>
          </div>
        </Card>

        <Card title="Lançamento rápido">
          <form action={addTransaction} className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Frame><select name="type" className="input w-full" aria-label="tipo">
              <option value="EXPENSE">Saída</option><option value="INCOME">Entrada</option><option value="INVESTMENT">Aporte</option><option value="TRANSFER">Transferência</option>
            </select></Frame>
            <Field name="date" type="date" required defaultValue={summary.date} />
            <Field name="amount" type="number" step="0.01" min="0.01" required placeholder="valor" />
            <Field name="description" placeholder="descrição" />
            <Frame><select name="paymentMethod" className="input w-full" aria-label="forma de pagamento" defaultValue="PIX">
              <option value="PIX">Pix</option><option value="DEBIT">Débito</option><option value="CASH">Dinheiro</option><option value="BOLETO">Boleto</option><option value="OTHER">Outro</option>
            </select></Frame>
            <Frame><select name="accountId" className="input w-full" aria-label="conta" defaultValue={defaultAccount?.id ?? ""}>
              <option value="">conta (não informada)</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select></Frame>
            <Frame><select name="creditCardId" className="input w-full" aria-label="cartão de crédito" defaultValue="">
              <option value="">sem cartão</option>
              {cards.map((c) => <option key={c.id} value={c.id}>crédito · {c.nickname} ····{c.last4}</option>)}
            </select></Frame>
            <Frame><select name="categoryId" className="input w-full" aria-label="categoria" defaultValue="">
              <option value="">categoria</option>
              <optgroup label="Saída">{byKind("EXPENSE").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
              <optgroup label="Entrada">{byKind("INCOME").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
              <optgroup label="Aporte">{byKind("INVESTMENT").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
            </select></Frame>
            <Frame><select name="toAccountId" className="input w-full" aria-label="conta destino (transferência)" defaultValue="">
              <option value="">destino (só transferência)</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select></Frame>
            <Btn tone="primary" frameClassName="col-span-2 sm:col-span-3">Lançar</Btn>
          </form>
          <p className="mt-2 text-xs muted">Escolher um cartão registra a compra como crédito na fatura do ciclo; a conta só é movimentada quando a fatura for paga.</p>
        </Card>

        <Card title="Últimos lançamentos">
          <table className="w-full text-sm">
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="group border-t align-top" style={{ borderColor: "var(--line)" }}>
                  <td className="mono py-1.5 pr-2 text-xs muted whitespace-nowrap">{shortDate(t.date)}</td>
                  <td className="py-1.5">
                    <div>{t.description || t.categoryName || TX_LABEL[t.type]}</div>
                    <div className="text-xs muted">{[t.categoryName, txSubline(t)].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className={`mono py-1.5 text-right whitespace-nowrap ${t.type === "INCOME" ? "" : "muted"}`}>{t.type === "INCOME" ? "+" : t.type === "TRANSFER" ? "↔" : "−"} {brl(t.amount)}</td>
                  <td className="py-1.5 pl-2 text-right"><form action={deleteTransaction.bind(null, t.id)}><button className="text-xs muted opacity-0 group-hover:opacity-100" title="apagar">apagar</button></form></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!transactions.length && <Empty>Sem lançamentos.</Empty>}
        </Card>
      </div>

      <div className="grid gap-6 content-start">
        <Card title="Contas">
          {accounts.map((a) => (
            <div key={a.id} className="flex justify-between py-1 text-sm">
              <span>{a.name} <span className="muted text-xs">{KIND_LABEL[a.kind] ?? a.kind.toLowerCase()}{a.isDefault ? " · padrão" : ""}{a.institution ? ` · ${a.institution}` : ""}</span></span>
              <span className="mono">{brl(a.balance)}</span>
            </div>
          ))}
          {unassigned !== 0 && <div className="mt-1 flex justify-between text-xs muted"><span>Sem conta informada</span><span className="mono">{brl(unassigned)}</span></div>}
          {!accounts.length && <Empty>Nenhuma conta. Crie via API: POST /accounts.</Empty>}
        </Card>

        <Card title="Faturas">
          {invoices.slice(0, 8).map((i) => (
            <div key={i.id} className="py-2 text-sm">
              <div className="flex justify-between"><span>{i.institution} · {String(i.refMonth).padStart(2, "0")}/{i.refYear}</span><span className="mono">{brl(i.total)}</span></div>
              <div className="text-xs muted">{i.status.toLowerCase() === "open" ? "aberta" : i.status.toLowerCase() === "closed" ? "fechada" : "paga"} · fecha {dateBR(i.closingDate)} · vence {dateBR(i.dueDate)} · {i.purchases} compra{i.purchases === 1 ? "" : "s"}</div>
              {i.status !== "PAID" && accounts.length > 0 && (
                <form action={payInvoice.bind(null, i.id)} className="mt-1 flex gap-1 text-xs">
                  <Frame className="flex-1"><select name="accountId" className="input w-full" defaultValue={defaultAccount?.id}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Frame>
                  <Field name="amount" type="number" step="0.01" placeholder={String(i.total)} frameClassName="w-24" />
                  <Btn>Pagar</Btn>
                </form>
              )}
            </div>
          ))}
          {!invoices.length && <Empty>Nenhuma fatura.</Empty>}
        </Card>

        <Card title="Cartões">
          {cards.map((c) => <div key={c.id} className="text-sm">{c.nickname} ····{c.last4} <span className="muted text-xs">{c.institution} · {c.brand.toLowerCase()}</span></div>)}
          {!cards.length && <Empty>Nenhum cartão. Crie via API: POST /institutions e /institutions/:id/cards.</Empty>}
        </Card>
      </div>
    </div>
  );
}
