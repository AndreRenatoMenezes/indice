import { Sketch } from "@indice/web";
import type { ReactNode } from "react";

// O Sketch mede o elemento pai e desenha por cima dele: o pai precisa ser
// `relative` e ter tamanho próprio.
function Box({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="relative flex items-center justify-center text-center text-sm" style={{ width: 190, height: 84 }}>
      {children}
      <span className="relative">{label}</span>
    </div>
  );
}

export function Molduras() {
  return (
    <div className="flex flex-wrap items-start gap-6" style={{ width: 660 }}>
      <Box label="raio 0 · retângulo"><Sketch radius={0} /></Box>
      <Box label="raio 10 · padrão"><Sketch /></Box>
      <Box label="raio 30 · cápsula"><Sketch radius={30} /></Box>
    </div>
  );
}

export function Espessuras() {
  return (
    <div className="flex flex-wrap items-start gap-6" style={{ width: 660 }}>
      <Box label="0.6 · divisor"><Sketch strokeWidth={0.6} /></Box>
      <Box label="0.85 · campo"><Sketch strokeWidth={0.85} /></Box>
      <Box label="1.6 · destaque"><Sketch strokeWidth={1.6} /></Box>
    </div>
  );
}

export function Preenchimentos() {
  return (
    <div className="flex flex-wrap items-start gap-6" style={{ width: 660 }}>
      <Box label="sólido"><Sketch fill="#b2f2bb" /></Box>
      <Box label="hachura"><Sketch fill="#2f9e44" fillStyle="hachure" /></Box>
      <Box label="tracejado"><Sketch dash stroke="#495057" /></Box>
    </div>
  );
}
