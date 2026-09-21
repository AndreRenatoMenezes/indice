import { Progress } from "@indice/web";

export function Etapas() {
  return (
    <div className="flex flex-col gap-4" style={{ width: 360 }}>
      <div><div className="text-xs muted">15%</div><Progress pct={15} /></div>
      <div><div className="text-xs muted">45%</div><Progress pct={45} /></div>
      <div><div className="text-xs muted">80%</div><Progress pct={80} /></div>
      <div><div className="text-xs muted">100%</div><Progress pct={100} /></div>
    </div>
  );
}

export function Vazio() {
  return (
    <div style={{ width: 360 }}>
      <div className="text-xs muted">ainda não começou</div>
      <Progress pct={0} />
    </div>
  );
}

export function ComCor() {
  return (
    <div className="flex flex-col gap-4" style={{ width: 360 }}>
      <div><div className="text-xs muted">livro · 210 de 480 páginas</div><Progress pct={44} color="#f08c00" /></div>
      <div><div className="text-xs muted">série · 6 de 8 episódios</div><Progress pct={75} color="#6741d9" /></div>
    </div>
  );
}
