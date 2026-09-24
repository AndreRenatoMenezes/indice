# design-sync — notas do repositório Índice

Contexto: o design system do Índice não é um pacote publicado. Ele são os
componentes de `apps/web/components/` (`sketch.tsx`, `ui.tsx`, `Nav.tsx`,
`palette.ts`) dentro do app Next.js. O sync roda na shape `package`.

## Como o build foi montado

- **`cfg.buildCmd` tem duas etapas** e as duas são obrigatórias antes do conversor:
  `node apps/web/.ds-css/build-css.mjs` (CSS) e `npx tsc -p tsconfig.ds-dist.json`
  dentro de `apps/web` (JS + `.d.ts` em `apps/web/dist/`).
- **CSS**: o app usa Tailwind v4, que precisa varrer os fontes para emitir os
  utilitários. `.ds-css/build-css.mjs` monta um entry com `@source` apontando
  para `components/`, `app/` e `.design-sync/previews/` — **um preview que usa
  uma classe Tailwind inédita só fica estilizado depois de rodar esse script de
  novo**. Ele também reescreve `url("/fonts/...")` (absoluto, servido de
  `public/`) para caminho relativo, senão o extrator de fontes do conversor não
  acha o Excalifont.
- **Fontes**: no app, Kalam e Fraunces vêm do `next/font`, que não existe fora
  do Next. O entry de CSS as carrega por `@import` do Google Fonts e redefine
  `--font-kalam` / `--font-fraunces`. Daí o `[FONT_REMOTE]` no validate — é
  esperado, não é pendência.
- **`next/navigation` e `next/link`**: `Nav` usa `usePathname`, que lança fora do
  App Router. `tsconfig.design-sync.json` mapeia os dois para shims em
  `apps/web/ds-shims/`. O diretório **não pode** começar com ponto: o `tsc`
  ignora diretórios pontilhados mesmo quando citados explicitamente no `include`.
- **`apps/web/package.json` ganhou `"types": "dist/ds-shims/ds-entry.d.ts"`**.
  Sem isso o `findTypesRoot` do conversor escolhe `apps/web/lib/` (ordem
  `types > lib > dist`), não acha `.d.ts` nenhum e todo componente sai com
  `[key: string]: unknown` em vez do contrato de props real.
- `npm ci` não foi rodado: `node_modules` já estava instalado e havia servidor
  de dev em execução em cima dele.

## Known render warns

- `[FONT_REMOTE] "Fraunces", "Kalam", "Segoe Print"` — por desenho (acima).
- `[RENDER_THIN]` em componentes ainda sem preview autorado é o card de piso,
  não é falha.

## Aprendizados dos previews

- `Sketch` mede o elemento pai e exige `position: relative` nele. Os
  componentes de `ui.tsx` já resolvem isso; ao compor um preview cru com
  `Sketch`, o wrapper precisa ser `relative` e ter altura própria.
- As células do preview não têm largura natural: `Card`, `Progress` e `Field`
  precisam de um wrapper com `style={{ width: N }}`. Card com quatro `Stat`
  quebra o valor em duas linhas abaixo de ~680px.
- O DS **não tem tratamento visual para `disabled`** — um preview de estado
  desabilitado sai idêntico ao normal. Não vale como variante.

## Riscos de re-sync

- `apps/web/dist/` e `.ds-css/styles.built.css` são gerados e estão no
  `.gitignore`: num clone novo, rodar `cfg.buildCmd` antes do conversor.
- As três decisões acopladas ao app — o campo `types` no `package.json`, os
  shims em `ds-shims/` e os dois tsconfigs extras — estão no repositório. Se
  alguém removê-las achando que são resto, o sync volta a degradar em silêncio
  (props vazias, `Nav` sem renderizar).
- Os previews usam dados inventados plausíveis (valores em BRL, datas de
  set/2026). Não vêm do seed, então não envelhecem junto com o banco.
- O `@import` do Google Fonts amarra a aparência a um recurso de rede. Se o
  ambiente de render não tiver saída para a internet, Fraunces e Kalam caem no
  fallback e só o Excalifont (que é empacotado) sobrevive.
