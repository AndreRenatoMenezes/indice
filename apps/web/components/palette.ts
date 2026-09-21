// Paleta dos artboards (`design/gen.cjs`). Módulo sem "use client": constantes
// importadas de um módulo cliente viram referências opacas no servidor.
export const INK = "#221f1c";
export const MUTED = "#6f665c";
export const PALETTE = {
  green: ["#d6e6cf", "#3f6b3d"],
  yellow: ["#f2e7c3", "#b8860b"],
  red: ["#eccfc9", "#b5453b"],
  blue: ["#a5d8ff", "#1971c2"],
  violet: ["#d0bfff", "#7048e8"],
  gray: ["#e9ecef", "#868e96"],
  orange: ["#ffd8a8", "#e8590c"],
} as const;
export type Tone = keyof typeof PALETTE;
