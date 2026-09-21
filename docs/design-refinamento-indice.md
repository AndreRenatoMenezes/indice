# Índice — refinamento visual (traço fino + títulos em Fraunces)

Brief para implementar no `apps/web` as duas decisões tomadas no design system "Índice":

1. **Traço mais fino e reto.** As molduras continuam feitas com rough.js, mas com roughness e bowing baixos, uma passada só (sem o contorno duplo) e traços mais finos.
2. **Títulos em uma serifada.** Nome "Índice" e títulos de card passam para Fraunces. Todo o resto continua em Excalifont.

Não mudam: cores, espaçamentos, raios e tamanhos de texto do conteúdo.

Base: `main` @ `fcf9bb4`.

---

## 1. `apps/web/components/sketch.tsx`

### `Sketch`

| O quê | Antes | Depois |
|---|---|---|
| default `strokeWidth` | `1.3` | `1` |
| default `roughness` | `1` | `0.38` |
| `bowing` nas options | `1` | `0.25` |
| segunda passada | só com `single` | **sempre** `options.disableMultiStroke = true` |
| `hachureGap` | `6` | `4.5` |
| `fillWeight` | `0.7` | `0.5` |
| `strokeLineDash` (quando `dash`) | `[7, 7]` | `[5, 4]` |
| `pad` (sangria da moldura) | `5` | `2` |

A prop `single` pode continuar existindo para não quebrar chamadas, mas deixa de ter efeito. Atualize o comentário do topo do arquivo.

### `SketchLine`

| O quê | Antes | Depois |
|---|---|---|
| default `strokeWidth` | `1` | `0.6` |
| `roughness` | `0.8` | `0.3` |
| `bowing` | `0.6` | `0.15` |

## 2. Espessuras nos componentes e páginas

Escala nova (o nome do token do design system está entre parênteses):

- divisor: 0.6 (`stroke-hairline`)
- campo, frame e botão comum: 0.85 (`stroke-field`)
- pill, tile e trilho de progresso: 0.9 (`stroke-pill` / `stroke-tile`)
- card e botão primário: 1 (`stroke-card`)
- linha do header: 1.1 (`stroke-nav`)
- sublinhado do link ativo e do dot de hoje: 1.6 (`stroke-active`)
- borda dos dots: 1.2 (`stroke-dot`)

| Arquivo : linha | Antes | Depois |
|---|---|---|
| `components/ui.tsx:10` (Frame) | `strokeWidth={1}` | `strokeWidth={0.85}` |
| `components/ui.tsx:44` (Progress trilho) | `strokeWidth={1.2}` | `strokeWidth={0.9}` |
| `components/ui.tsx:47` (Progress preenchimento) | `strokeWidth={1} roughness={0.6}` | `strokeWidth={0.85} roughness={0.3}` |
| `components/ui.tsx:61` (Pill) | `strokeWidth={1.1}` | `strokeWidth={0.9}` |
| `components/ui.tsx:72` (Btn) | `tone === "primary" ? 1.3 : 1` | `tone === "primary" ? 1 : 0.85` |
| `components/Nav.tsx:35` (link ativo) | `strokeWidth={2}` | `strokeWidth={1.6}` |
| `components/Nav.tsx:42` (linha do header) | `strokeWidth={1.4}` | `strokeWidth={1.1}` |
| `app/page.tsx:32` (divisor) | `strokeWidth={0.8}` | `strokeWidth={0.6}` |
| `app/page.tsx:77` (tile de hábito) | `strokeWidth={1.2}` | `strokeWidth={0.9}` |
| `app/habitos/page.tsx:27` (tile) | `strokeWidth={1.2}` | `strokeWidth={0.9}` |
| `app/habitos/page.tsx:39` (botão ✓/○) | `strokeWidth={1.2}` | `strokeWidth={0.9}` |
| `app/midia/page.tsx:33` (etiqueta do tipo) | `strokeWidth={1}` | `strokeWidth={0.85}` |

`Card` usa o default do `Sketch`, então passa para 1 sozinho.

## 3. `apps/web/app/globals.css`

```css
.dot { /* ... */ border: 1.2px solid var(--muted); }   /* era 1.5px */
.dot-today { border-color: var(--fg); border-width: 1.6px; }  /* era 2px */
```

Adicione a família dos títulos ao tema do Tailwind v4. Ela gera a classe `font-heading`:

```css
@theme {
  --font-heading: var(--font-fraunces), Georgia, serif;
}
```

## 4. `apps/web/app/layout.tsx` — carregar a Fraunces

```tsx
import { Fraunces, Kalam } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-fraunces", display: "swap" });
// ...
<html lang="pt-BR" className={`${kalam.variable} ${fraunces.variable}`}>
```

Não troque a fonte do `body`: ela continua `"Excalifont", var(--font-kalam), …`.

## 5. Títulos em Fraunces

**Regra:** tudo que é cabeçalho fica "impresso" em Fraunces, e tudo que é conteúdo fica "escrito" em Excalifont. Não misture: conteúdo nunca vai em Fraunces, e título nunca vai em Excalifont.

| Onde | Antes | Depois |
|---|---|---|
| `components/Nav.tsx:28` (nome "Índice") | `className="text-2xl"` | `className="font-heading text-[26px] leading-[1.2]"` |
| `components/ui.tsx:22` (título do Card) | `className="text-[13px] uppercase tracking-[0.04em] muted"` | `className="font-heading text-[12px] font-medium uppercase tracking-[0.09em] muted"` |

Se surgirem títulos de tela (h1) ou de folha/diálogo, use estes estilos:

- título de tela: `font-heading`, 38px, line-height 1.05, peso 400
- título de folha: `font-heading`, 26px, line-height 1.2, peso 400

Números, labels de `Stat`, botões, campos e legendas **continuam** em Excalifont.

## 6. Fora do escopo

- Android (`apps/android`): usa outra paleta e o Material. Não mexa nele agora.
- `design/gen.cjs` (artboards): se quiser que batam com o app, aplique os mesmos valores de roughness, bowing, passada única e espessura em `rectDrawable`, `hline` e `circle`, e a Fraunces nos títulos.

## 7. Como verificar

1. Rode `npm run dev`, abra `http://localhost:3000` e compare Hoje, Financeiro e Hábitos com os previews do design system.
2. As molduras devem ter um traço só, quase reto e fino, sem o contorno duplicado.
3. O nome "Índice" e os títulos dos cards devem aparecer em serifada; o resto continua manuscrito.
4. Rode `npm run typecheck`.
