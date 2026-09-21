import { Card, Stat } from "@indice/web";

export function Numeros() {
  return (
    <div className="grid grid-cols-4 gap-3" style={{ width: 720 }}>
      <Stat label="Saldo do mês" value="R$ 2.480,00" />
      <Stat label="Por dia" value="R$ 82,60" />
      <Stat label="Gasto hoje" value="R$ 54,90" />
      <Stat label="Contas abertas" value="R$ 310,00" />
    </div>
  );
}

export function ComTom() {
  return (
    <div className="grid grid-cols-3 gap-3" style={{ width: 480 }}>
      <Stat label="Sobrou" value="R$ 640,00" tone="green" />
      <Stat label="No limite" value="R$ 80,00" tone="yellow" />
      <Stat label="Estourou" value="-R$ 120,00" tone="red" />
    </div>
  );
}

export function DentroDeCard() {
  return (
    <div style={{ width: 520 }}>
      <Card title="Metas">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Concluídas" value="3" tone="green" />
          <Stat label="Em andamento" value="2" />
          <Stat label="Paradas" value="1" tone="red" />
        </div>
      </Card>
    </div>
  );
}
