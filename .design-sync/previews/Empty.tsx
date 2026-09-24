import { Card, Empty } from "@indice/web";

export function Solto() {
  return (
    <div style={{ width: 420 }}>
      <Empty>Nenhum lançamento hoje.</Empty>
    </div>
  );
}

export function DentroDeCard() {
  return (
    <div style={{ width: 520 }}>
      <Card title="Mídia">
        <Empty>Nada em andamento por aqui.</Empty>
      </Card>
    </div>
  );
}
