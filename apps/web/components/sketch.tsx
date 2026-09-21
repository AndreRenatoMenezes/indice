"use client";

// Molduras desenhadas à mão, no mesmo vocabulário dos artboards de `design/`:
// rough.js com seed estável por elemento, traço por cima do conteúdo do pai.
// O pai precisa ser `position: relative` — os componentes de `ui.tsx` já são.
import { useEffect, useId, useRef, useState } from "react";
import rough from "roughjs";
import type { Options } from "roughjs/bin/core";
import { INK } from "./palette";

const generator = rough.generator();

// Seed determinística a partir do id do React: estável entre SSR, hidratação e
// re-renders, e diferente para cada elemento — cada moldura tem o traço próprio.
function seedFrom(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return Math.abs(h) % 2147483647;
}

function roundRectPath(w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0, ${w} ${r} L ${w} ${h - r} Q ${w} ${h}, ${w - r} ${h} L ${r} ${h} Q 0 ${h}, 0 ${h - r} L 0 ${r} Q 0 0, ${r} 0`;
}

/** Mede o pai e redesenha quando ele muda de tamanho. */
function useParentSize(ref: React.RefObject<SVGSVGElement | null>) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const measure = () => setSize({ w: parent.offsetWidth, h: parent.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export type SketchProps = {
  /** Cantos arredondados; 0 desenha retângulo reto. */
  radius?: number;
  strokeWidth?: number;
  stroke?: string;
  /** Preenchimento sólido (cores de `PALETTE`). */
  fill?: string;
  fillStyle?: Options["fillStyle"];
  dash?: boolean;
  /** Traço único, sem a segunda passada do rough. */
  single?: boolean;
  roughness?: number;
};

/** Retângulo desenhado à mão que cobre o elemento pai. */
export function Sketch({ radius = 10, strokeWidth = 1.3, stroke = INK, fill, fillStyle = "solid", dash, single, roughness = 1 }: SketchProps) {
  const ref = useRef<SVGSVGElement>(null);
  const size = useParentSize(ref);
  const seed = seedFrom(useId());
  const pad = 5;

  let paths: ReturnType<typeof generator.toPaths> = [];
  if (size && size.w > 0 && size.h > 0) {
    const options: Options = { seed, roughness, strokeWidth, stroke, bowing: 1 };
    if (fill) { options.fill = fill; options.fillStyle = fillStyle; options.hachureAngle = -41; options.hachureGap = 6; options.fillWeight = 0.7; }
    if (dash) options.strokeLineDash = [7, 7];
    if (single) options.disableMultiStroke = true;
    const drawable = radius > 0
      ? generator.path(roundRectPath(size.w, size.h, radius), options)
      : generator.rectangle(0, 0, size.w, size.h, options);
    paths = generator.toPaths(drawable);
  }

  return (
    <svg
      ref={ref}
      aria-hidden="true"
      viewBox={size ? `${-pad} ${-pad} ${size.w + pad * 2} ${size.h + pad * 2}` : undefined}
      style={{ position: "absolute", left: -pad, top: -pad, width: `calc(100% + ${pad * 2}px)`, height: `calc(100% + ${pad * 2}px)`, pointerEvents: "none", overflow: "visible" }}
    >
      {paths.map((p, i) => (
        <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill || "none"} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}

/** Linha horizontal desenhada à mão, ocupando a largura disponível. */
export function SketchLine({ stroke = INK, strokeWidth = 1, className }: { stroke?: string; strokeWidth?: number; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [w, setW] = useState(0);
  const seed = seedFrom(useId());
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const paths = w > 0
    ? generator.toPaths(generator.line(0, 0, w, 0, { seed, roughness: 0.8, strokeWidth, stroke, bowing: 0.6, disableMultiStroke: true }))
    : [];
  return (
    <svg ref={ref} aria-hidden="true" viewBox={`-2 -4 ${w + 4} 8`} preserveAspectRatio="none" className={className} style={{ display: "block", width: "100%", height: 8, flexShrink: 0 }}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
