import { Btn, Card, Field } from "@indice/web";

export function Tons() {
  return (
    <div className="flex items-center gap-3">
      <Btn tone="primary">Salvar</Btn>
      <Btn>Adicionar</Btn>
      <Btn tone="ghost">cancelar</Btn>
    </div>
  );
}

export function EmFormulario() {
  return (
    <div className="flex items-center gap-2" style={{ width: 420 }}>
      <Btn tone="primary" frameClassName="w-full">Lançar despesa</Btn>
      <Btn tone="ghost" frameClassName="w-full">limpar</Btn>
    </div>
  );
}

export function DentroDeCard() {
  return (
    <div style={{ width: 520 }}>
      <Card title="Lançamento rápido">
        <div className="grid grid-cols-2 gap-2">
          <Field placeholder="valor" defaultValue="54,90" />
          <Field placeholder="descrição" defaultValue="almoço" />
        </div>
        <div className="flex gap-2">
          <Btn tone="primary">Lançar</Btn>
          <Btn tone="ghost">cancelar</Btn>
        </div>
      </Card>
    </div>
  );
}
