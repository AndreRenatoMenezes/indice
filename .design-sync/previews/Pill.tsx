import { Card, Pill } from "@indice/web";

export function Semaforo() {
  return (
    <div className="flex items-center gap-3">
      <Pill tone="green">no ritmo</Pill>
      <Pill tone="yellow">atenção</Pill>
      <Pill tone="red">estourou</Pill>
    </div>
  );
}

export function Paleta() {
  return (
    <div className="flex flex-wrap items-center gap-3" style={{ width: 460 }}>
      <Pill tone="blue">leitura</Pill>
      <Pill tone="violet">meta</Pill>
      <Pill tone="orange">fatura</Pill>
      <Pill tone="gray">arquivado</Pill>
    </div>
  );
}

export function ComoAside() {
  return (
    <div style={{ width: 520 }}>
      <Card title="Hábitos" aside={<Pill tone="green">5 de 5 hoje</Pill>}>
        <p className="text-sm">É assim que a Pill aparece nas telas: presa ao cabeçalho do Card, resumindo o estado.</p>
      </Card>
    </div>
  );
}
