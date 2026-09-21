import { Btn, Card, Field } from "@indice/web";

export function Tipos() {
  return (
    <div className="grid grid-cols-2 gap-2" style={{ width: 460 }}>
      <Field placeholder="descrição" />
      <Field type="number" step="0.01" placeholder="valor" defaultValue="54.90" />
      <Field type="date" defaultValue="2026-09-20" />
      <Field type="time" defaultValue="20:30" />
    </div>
  );
}

export function Preenchido() {
  return (
    <div style={{ width: 420 }}>
      <Field defaultValue="Jantar com a Emanuele" />
    </div>
  );
}

export function LinhaDeFormulario() {
  return (
    <div style={{ width: 560 }}>
      <Card title="Lançamento rápido">
        <div className="grid grid-cols-3 gap-2">
          <Field type="date" defaultValue="2026-09-20" />
          <Field type="number" placeholder="valor" defaultValue="54.90" />
          <Field placeholder="descrição" defaultValue="almoço" />
        </div>
        <div className="flex gap-2"><Btn tone="primary">Lançar</Btn></div>
      </Card>
    </div>
  );
}
