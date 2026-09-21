// Paleta dos artboards (`design/gen.cjs`). Módulo sem "use client": constantes
// importadas de um módulo cliente viram referências opacas no servidor.
export const INK = "#1e1e1e";
export const MUTED = "#495057";
export const PALETTE = {
  green: ["#b2f2bb", "#2f9e44"],
  yellow: ["#ffec99", "#f08c00"],
  red: ["#ffc9c9", "#e03131"],
  blue: ["#a5d8ff", "#1971c2"],
  violet: ["#d0bfff", "#7048e8"],
  gray: ["#e9ecef", "#868e96"],
  orange: ["#ffd8a8", "#e8590c"],
} as const;
export type Tone = keyof typeof PALETTE;
