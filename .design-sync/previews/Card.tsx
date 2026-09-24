import { Card, Empty, Pill, Stat } from "@indice/web";

export function ResumoFinanceiro() {
  return (
    <div style={{ width: 680 }}>
      <Card title="Financeiro · setembro de 2026" aside={<Pill tone="green">no ritmo</Pill>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Saldo do mês" value="R$ 2.480,00" />
          <Stat label="Por dia" value="R$ 82,60" tone="green" />
          <Stat label="Gasto hoje" value="R$ 54,90" />
          <Stat label="Contas abertas" value="R$ 310,00" />
        </div>
        <div className="mt-2 flex justify-between text-xs muted">
          <span>Dá para gastar um pouco mais hoje.</span>
          <span>12 dias restantes</span>
        </div>
      </Card>
    </div>
  );
}

export function DiarioDoDia() {
  return (
    <div style={{ width: 520 }}>
      <Card title="Hoje · 20/09/2026 · domingo" aside={<Pill tone="yellow">atenção</Pill>}>
        <ul className="space-y-1">
          <li className="flex items-center gap-2 text-sm"><span className="mono w-5">•</span><span>Fechar o mês no Índice</span><span className="mono text-xs muted">09:00</span></li>
          <li className="flex items-center gap-2 text-sm"><span className="mono w-5">×</span><span className="line-through muted">Pagar a fatura do cartão</span></li>
          <li className="flex items-center gap-2 text-sm"><span className="mono w-5">○</span><span>Jantar com a Emanuele</span><span className="mono text-xs muted">20:30</span></li>
          <li className="flex items-center gap-2 text-sm"><span className="mono w-5">–</span><span>Ideia: usar o traço fino também nos artboards</span><span className="text-xs">**</span></li>
        </ul>
      </Card>
    </div>
  );
}

export function ComTom() {
  return (
    <div style={{ width: 520 }}>
      <Card title="Metas" tone="violet" aside={<span className="text-xs muted">3 de 5</span>}>
        <p className="text-sm">O tom pinta o preenchimento da moldura com a cor da paleta, mantendo o traço de tinta.</p>
      </Card>
    </div>
  );
}

export function SemConteudo() {
  return (
    <div style={{ width: 520 }}>
      <Card title="Mídia">
        <Empty>Nada em andamento por aqui.</Empty>
      </Card>
    </div>
  );
}
