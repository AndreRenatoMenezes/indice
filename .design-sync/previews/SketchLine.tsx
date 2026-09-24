import { SketchLine } from "@indice/web";

export function Divisor() {
  return (
    <div style={{ width: 460 }}>
      <p className="text-sm">Primeiro bloco de conteúdo.</p>
      <SketchLine />
      <p className="text-sm">Segundo bloco, depois do divisor.</p>
    </div>
  );
}

export function Espessuras() {
  return (
    <div className="flex flex-col gap-3" style={{ width: 460 }}>
      <div><div className="text-xs muted">0.6 · divisor entre itens</div><SketchLine strokeWidth={0.6} /></div>
      <div><div className="text-xs muted">1.1 · linha do header</div><SketchLine strokeWidth={1.1} /></div>
      <div><div className="text-xs muted">1.6 · sublinhado do link ativo</div><SketchLine strokeWidth={1.6} /></div>
    </div>
  );
}

export function ComCor() {
  return (
    <div className="flex flex-col gap-3" style={{ width: 460 }}>
      <SketchLine stroke="#868e96" />
      <SketchLine stroke="#2f9e44" strokeWidth={1.1} />
      <SketchLine stroke="#e03131" strokeWidth={1.1} />
    </div>
  );
}
