# Design — telas do Índice em estilo Excalidraw

Canvas publicada (Claude Design): https://claude.ai/artifact/2oQb8L5wtReXgt1i7TpADV

Esta pasta não faz parte do workspace npm do monorepo; é uma ferramenta à parte.

## O que há aqui

| Caminho | Papel |
|---|---|
| `gen.cjs` | Gera os oito artboards (`.dc.html`) a partir de código: seis telas Android 390×844, o widget de hábitos e o painel Web 1280. Traços via rough.js com seed por elemento. |
| `xlib.cjs` | Conversor mínimo de itens `.excalidrawlib` (rectangle, ellipse, diamond, line, arrow, freedraw, text) para SVG, usando rough.js com o seed original de cada elemento. |
| `artboards/` | Saída gerada: os `.dc.html` e o `canvas.json` publicados na canvas. |
| `fonts/` | Excalifont em sete subconjuntos woff2 (MIT, repositório excalidraw). Na canvas estão enviados como assets; as URLs `/_blob/…` em `gen.cjs` apontam para eles. |

## Regenerar

```bash
cd design
npm install
npm run libs        # clona excalidraw-libraries (MIT) ao lado, ~150 MB, ignorado pelo git
npm run gen         # escreve artboards/*.dc.html
```

Depois, publicar os arquivos alterados na canvas pelo Claude (Artifact tool, `root` = esta pasta com os arquivos em `project/`), ou abrir cada `.dc.html` no editor da canvas.

## Créditos e licenças

- rough.js (MIT) e perfect-freehand (MIT).
- Excalifont (MIT) — https://github.com/excalidraw/excalidraw
- Itens do excalidraw-libraries (MIT): "Checkbox Checked/Unchecked" do Universal UI Kit (Manuel Ernesto Garcia) e "Go forward arrow" / "Check mark" do Basic UX Wireframing Elements (Gabriela Macakova).

## Dados nas telas

Números do seed e do teste da API de 18/09/2026. O alvo da meta (R$ 120.000), os marcos e os itens de mídia entre colchetes são ilustrativos.
