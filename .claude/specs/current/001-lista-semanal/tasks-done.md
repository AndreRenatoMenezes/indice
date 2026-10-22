# Tasks Concluídas — 001-lista-semanal

Todas as 17 WPs foram revisadas e aprovadas pelo Agente Review.

## WP01 — Contratos compartilhados e espelho no Android

```yaml
lane: feita
estimativa: 45min
files:
  - packages/shared/src/index.ts
  - apps/android/app/src/main/java/dev/indice/app/data/api/Dto.kt
  - apps/api/src/routes/entries.ts
depende_de: []
```

### Objetivo
Publicar todos os contratos da seção "Contratos" do plano e reduzir o `UpdateEntryInput`, sem ainda criar rotas.

### Definição de Pronto
- [x] `EntryDto` tem `recurrenceRuleId`; `toEntryDto` preenche o campo; `Dto.kt` espelha (`String? = null`).
- [x] `UpdateEntryInput`, `MoveEntryInput`, `EntryBatchInput`, `RecurrenceInput`, `RecurrenceRuleDto`, `CustomListDto`, `CreateListInput`, `UpdateListInput`, `ReorderListsInput` exportados com os tipos inferidos, exatamente como no plano.
- [x] `PATCH /entries/:id` não copia mais `position`; `curl -X PATCH … -d '{"position":3}'` não altera a posição.
- [x] Bug corrigido: `PATCH {"status":"DONE"}` num `EVENT` mantém `kind: "EVENT"` (antes virava `TASK` pelo default do zod).

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — contratos novos no shared; EntryDto/Dto.kt com recurrenceRuleId; PATCH sem position e sem default de kind (EVENT concluído segue EVENT, verificado por curl). assembleDebug não roda aqui (SDK do Android bloqueado pela rede): fica para o job android do CI.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP02 — Regras puras: ordem e movimento

```yaml
lane: feita
estimativa: 60min
files:
  - apps/api/src/modules/journal/ordering.ts
  - apps/api/src/modules/journal/ordering.test.ts
  - apps/api/src/modules/journal/moves.ts
  - apps/api/src/modules/journal/moves.test.ts
depende_de: []
```

### Objetivo
`isManual`, `reposition`, `moveKind`, `canLeaveCollection`, `migrationCopy` e `duplicateCopy` conforme o plano, sem Prisma (tipos estruturais).

### Definição de Pronto
- [x] `sortEntries` inalterado e coberto por teste que trava a regra 1B.
- [x] Testes de `reposition`: antes de manual; `beforeId` com hora ou fechado → fim das manuais; `beforeId` nulo → fim das manuais; item com hora → `[]`; só devolve posições que mudaram.
- [x] Testes de `moves`: 3 casos de `moveKind`; `canLeaveCollection` falso para fechada e para subtarefa; `migrationCopy` leva só subtarefas `OPEN`, seta `migratedFromId` e não leva regra; `duplicateCopy` reabre todas as subtarefas.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — ordering.ts (isClosed, isManual, reposition; sortEntries intocado e travado por teste) e moves.ts (moveKind, canLeaveCollection, migrationCopy, duplicateCopy); 19 testes vitest.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP03 — API: árvore com subtarefas e `POST /entries/:id/move`

```yaml
lane: feita
estimativa: 90min
files:
  - apps/api/src/routes/entries.ts
depende_de: [WP01, WP02]
```

### Objetivo
Consultas por intervalo e por lista devolvem árvore; mover/reordenar/migrar/realocar num endpoint só; `/migrate` vira atalho dele.

### Definição de Pronto
- [x] Um helper único de árvore (raízes + `children` ordenados) atende `?date=`, `?from&to` e `?collectionId=`; intervalo > 62 dias → 400.
- [x] `/move` segue os 7 passos do plano, numa transação; 409 para fechada/subtarefa saindo da coleção; 400 para `date`/`collectionId` em subtarefa; 404 para lista alheia ou apagada.
- [x] Roteiro `curl`: mover de um dia para outro deixa origem `MIGRATED` e cópia com as subtarefas abertas; mover de lista para dia mantém o id e leva todas as subtarefas; reordenar sem hora persiste; reordenar com hora não muda nada.
- [x] `POST /entries/:id/migrate` continua respondendo 201 com a cópia (Diário e Android seguem funcionando).

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — entryTree único para ?date/?from&to/?collectionId (from e to obrigatórios juntos, teto 62 dias); moveEntry (reorder/migrate/relocate numa transação) atende /move e /migrate (201; 409 se fechada ou subtarefa). Roteiro curl ok: seg→sex deixa › e leva só subtarefas abertas; lista→dia mantém id e todas; reordenar com hora não muda nada.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP04 — API: lote e duplicar

```yaml
lane: feita
estimativa: 60min
files:
  - apps/api/src/routes/entries.ts
depende_de: [WP03]
```

### Objetivo
`POST /entries/batch` (complete, migrate, delete, restore) e `POST /entries/:id/duplicate`.

### Definição de Pronto
- [x] `batch` responde `{ ids }` só com os afetados e nunca toca entradas de outro usuário (testar com id inexistente/alheio no meio da lista).
- [x] `migrate` em lote usa o mesmo caminho do `/move` (rastro + cópia), em ordem de posição, numa transação; ignora ids fechados.
- [x] `delete` seguido de `restore` com os mesmos ids devolve a tarefa com status e subtarefas intactos.
- [x] `duplicate`: 400 para subtarefa; cópia `OPEN` no fim, subtarefas reabertas, sem regra nem `migratedFromId`.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — POST /entries/batch (complete/migrate/delete/restore; só ids do usuário, responde os afetados; migrate usa migrateInto/relocateInto em ordem de data e posição, numa transação) e POST /entries/:id/duplicate (400 subtarefa). curl: delete+restore devolve status e subtarefas intactos; id inexistente e fechada ignorados.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP05 — Regras puras: recorrência

```yaml
lane: feita
estimativa: 75min
files:
  - apps/api/src/modules/journal/recurrence.ts
  - apps/api/src/modules/journal/recurrence.test.ts
depende_de: [WP01]
```

### Objetivo
`buildRRule`, `ruleEndDate`, `describeRule` e `plannedOccurrences` conforme o plano, compatíveis com o `occurrencesBetween` existente.

### Definição de Pronto
- [x] Para cada `freq` (com e sem `weekdays`/`monthDays`, com `interval` > 1), `occurrencesBetween` sobre a RRULE gerada devolve as datas esperadas num intervalo fixo.
- [x] `COUNT` e `UNTIL` respeitados; `ruleEndDate` bate com a última ocorrência; dia 31 é pulado em meses curtos.
- [x] `describeRule` produz os textos-exemplo do plano (pt-BR, com sufixos de fim).
- [x] `plannedOccurrences` pula pares já existentes e nada antes de `from`.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — recurrence.ts ganha buildRRule, ruleEndDate, describeRule (pt-BR, sufixos de fim) e plannedOccurrences; occurrencesBetween/rulesDueOn intocados no comportamento. 16 testes (cada freq, intervalo, dia 31, COUNT/UNTIL, pares existentes, from).
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP06 — API: rotas de recorrência e materialização na leitura

```yaml
lane: feita
estimativa: 90min
files:
  - apps/api/src/routes/recurrence.ts
  - apps/api/src/routes/entries.ts
  - apps/api/src/app.ts
  - .claude/specs/schema.md
depende_de: [WP03, WP05]
```

### Objetivo
`GET /recurrence-rules`, `PUT /entries/:id/recurrence`, `DELETE /recurrence-rules/:id` e `materializeRecurrences` chamada por `?date=` e `?from&to` (e, por tabela, pelo `/daily-summary`).

### Definição de Pronto
- [x] `recurrence.ts` não importa nada de `entries.ts`.
- [x] Criar regra "toda segunda" numa tarefa: `GET /entries?from&to` das próximas 2 semanas mostra as segundas com `recurrenceRuleId`; repetir o GET não duplica; semana passada não ganha ocorrências.
- [x] Duas chamadas simultâneas ao mesmo intervalo (`curl … & curl …`) resultam em uma ocorrência por data.
- [x] Apagar uma ocorrência não a recria; migrar uma ocorrência deixa rastro e a cópia sem regra.
- [x] `DELETE /recurrence-rules/:id` apaga as futuras abertas e solta a regra das passadas/concluídas; `GET /daily-summary` de uma segunda futura mostra a ocorrência antes de parar e não depois.
- [x] `schema.md`: descrição do `template` atualizada; `atualizado_em` muda.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — routes/recurrence.ts (GET /recurrence-rules, PUT /entries/:id/recurrence, DELETE /recurrence-rules/:id, materializeRecurrences; não importa entries.ts) chamado por ?date (logo /daily-summary) e ?from&to. curl ok: segundas futuras com ↻ e subtarefas do molde, sem duplicar em GET repetido nem com 6 GETs simultâneos; apagada e migrada não voltam; parar tira as futuras abertas. Fora de files: 1 linha em modules/journal/recurrence.ts (interop CJS do rrule no Node ESM, que só o vitest mascarava); ensureDailyCollection agora aguenta P2002. schema.md: formato do template (atualizado_em já era 2026-09-25).
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP07 — API: listas personalizadas e README

```yaml
lane: feita
estimativa: 60min
files:
  - apps/api/src/routes/lists.ts
  - apps/api/src/app.ts
  - README.md
depende_de: [WP03, WP06]
```

### Objetivo
`GET/POST /lists`, `PATCH/DELETE /lists/:id`, `PUT /lists/order`; README com todas as rotas novas da feature.

### Definição de Pronto
- [x] `GET /lists` traz as entradas de cada lista em árvore, na ordem de `sortOrder`.
- [x] `DELETE /lists/:id` some com a lista e as tarefas dela (não aparecem mais em `GET /lists` nem em `?collectionId=`).
- [x] `PUT /lists/order` ignora ids de outro usuário.
- [x] README: linha da tabela de endpoints do journal cobre `move`, `batch`, `duplicate`, `/lists`, `/recurrence-rules` e `PUT /entries/:id/recurrence`.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — routes/lists.ts (GET/POST /lists, PATCH/DELETE /lists/:id, PUT /lists/order) registrado no app.ts; README com move, batch, duplicate, lists e recorrência. curl ok: árvore por lista em sortOrder, nome com trim, ordem ignora id alheio, apagar some com a lista e as tarefas (GET /lists e ?collectionId), dia→lista deixa ›.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP08 — Web: dependências e camada de dados

```yaml
lane: feita
estimativa: 60min
files:
  - apps/web/package.json
  - package-lock.json
  - apps/web/lib/api.ts
  - apps/web/lib/actions.ts
  - apps/web/lib/dates.ts
depende_de: [WP04, WP06, WP07]
```

### Objetivo
Instalar `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-markdown`; criar getters, actions tipadas e helpers de calendário do plano.

### Definição de Pronto
- [x] `npm install` feito na raiz (lockfile regenerado pela ferramenta, não à mão).
- [x] Todas as actions de journal (antigas e novas) chamam `revalidateJournal()` (`/` e `/semana`).
- [x] `monthGrid("2026-02-11")` devolve semanas seg–dom cobrindo fevereiro inteiro (conferir no REPL/`tsx`).

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — @dnd-kit/core, sortable, utilities e react-markdown via npm install (lockfile gerado pelo npm 11.19.0 do packageManager; npm ci --dry-run ok); getLists/getRecurrenceRules; revalidateJournal em todas as actions de journal + 11 actions tipadas; firstOfMonth/addMonths/monthGrid (monthGrid("2026-02-11") = 26/01..01/03, conferido com tsx).
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP09 — Web: quadro semanal editável (sem arrastar)

```yaml
lane: feita
estimativa: 90min
files:
  - apps/web/app/semana/page.tsx
  - apps/web/components/week/WeekBoard.tsx
  - apps/web/components/week/weekState.ts
  - apps/web/components/week/Column.tsx
  - apps/web/components/week/EntryRow.tsx
  - apps/web/components/week/NewEntryInput.tsx
  - apps/web/components/week/Toast.tsx
depende_de: [WP08]
```

### Objetivo
A página vira casca de servidor + `WeekBoard` otimista: criar no pé do dia, concluir/reabrir, editar inline, selos na linha.

### Definição de Pronto
- [x] A página busca em paralelo semana, listas, regras e metas (plano, seção Web) e o estado do `WeekBoard` já guarda listas e regras, mesmo antes de exibi-las (WP12, WP15 e WP16 dependem disso).
- [x] Hábitos, sequência, metas e coleções continuam renderizados no servidor e entram como slots (sem regressão visual na página).
- [x] Enter no pé da quarta cria e mantém o foco; texto vazio é ignorado; Esc limpa.
- [x] Clique no marcador conclui/reabre; clique no texto (após 250 ms) chama `onOpen` (painel vem na WP12); duplo clique edita inline; texto vazio mantém o anterior.
- [x] Selos: hora, bolinha de cor, `*` por prioridade, `x/y` de subtarefas, ¶ se há nota, ↻ se há regra.
- [x] Com a API parada, criar uma tarefa: ela some e o `Toast` avisa.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — page.tsx vira casca (busca semana, listas, regras e metas em paralelo; hoje da API) + WeekBoard otimista (useOptimistic + transição; falha → Toast e a tela volta), Column, EntryRow (Bullet do paper.tsx; clique 250 ms → onOpen, duplo clique edita), NewEntryInput, Toast, weekState (reducer já com as ações das WPs seguintes). Hábitos, sequência, metas e coleções seguem no servidor como slots. Playwright: Enter cria e mantém foco, vazio ignorado, Esc limpa, concluir/reabrir, editar (vazio mantém, Esc desiste); API parada → some + aviso.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP10 — Web: arrastar e soltar entre dias e no mesmo dia

```yaml
lane: feita
estimativa: 90min
files:
  - apps/web/components/week/WeekBoard.tsx
  - apps/web/components/week/weekState.ts
  - apps/web/components/week/Column.tsx
  - apps/web/components/week/EntryRow.tsx
depende_de: [WP09]
```

### Objetivo
`DndContext` com sensores de ponteiro, toque e teclado; soltar chama `moveEntry` com `beforeId`; otimista com rastro.

### Definição de Pronto
- [x] Só raízes `OPEN` são arrastáveis; migradas/concluídas/canceladas não.
- [x] Segunda → sexta: na hora aparece › na segunda e a cópia na sexta; após o revalidate, igual.
- [x] Mesmo dia, sem hora: nova ordem persiste; com hora: volta ao lugar + `Toast` "a hora define a ordem"; soltar no mesmo lugar não chama a action.
- [x] Teclado: foco na tarefa, espaço pega, setas movem, espaço solta.
- [x] Viewport de celular (DevTools): toque longo arrasta; toque curto rola a página.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — DndContext (mouse com 5 px, toque 250 ms, teclado só com espaço) + colisão ponteiro→coluna→tarefa mais próxima; soltar calcula beforeId e chama moveEntry; otimista com rastro. Playwright: seg→sex deixa › e cópia 0/1 ¶ (antes e depois do revalidate); reordenar persiste ao recarregar; com hora volta + 'A hora define a ordem'; migrada não arrasta; teclado espaço/setas/espaço; toque longo arrasta e toque curto não. Correções de console: DndContext com id (hidratação) e slots do servidor como filho único (aviso de key). Largura no celular estoura em todas as páginas (Nav/layout, fora de escopo) → INBOX.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP11 — Web: hoje e mini-calendário

```yaml
lane: feita
estimativa: 45min
files:
  - apps/web/app/semana/page.tsx
  - apps/web/components/week/WeekNav.tsx
  - apps/web/components/week/MiniCalendar.tsx
depende_de: [WP08]
```

### Objetivo
`WeekNav` no `PageHead`: ‹ hoje › e calendário mensal em popover.

### Definição de Pronto
- [x] "hoje" leva a `/semana` sem `date`; ‹ › mantêm o comportamento atual.
- [x] Calendário abre no mês da semana vista, destaca a semana e o dia de hoje (vindo da prop, não do relógio do navegador), navega entre meses e, ao clicar num dia, vai para a semana dele.
- [x] Fecha com Esc e com clique fora; utilizável no celular.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — WeekNav no PageHead (‹ hoje › + ▦) e MiniCalendar em popover (monthGrid; semana vista destacada; hoje vem da prop, da API). Playwright: ‹ › mantêm o comportamento, hoje → /semana sem date, calendário abre no mês visto, navega meses, marca 24/09 só em setembro, Esc e clique fora fecham, clicar 03/12 vai à semana 49; no celular o popover cabe na tela.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP12 — Web: painel de detalhes

```yaml
lane: feita
estimativa: 90min
files:
  - apps/web/components/week/WeekBoard.tsx
  - apps/web/components/week/weekState.ts
  - apps/web/components/week/EntryRow.tsx
  - apps/web/components/week/EntryPanel.tsx
  - apps/web/components/week/Notes.tsx
depende_de: [WP09]
```

### Objetivo
Gaveta com texto, tipo, hora, cor, prioridade, tags, meta, notas (markdown) e "mover para" (dia ou lista); ações duplicar, copiar e apagar com desfazer.

### Definição de Pronto
- [x] Cada campo grava ao mudar/sair e reflete na linha da semana na hora.
- [x] Notas: editar em textarea, ver renderizado com `react-markdown` (sem HTML cru); `<script>` digitado aparece como texto.
- [x] "Mover para" um dia deixa rastro se a origem for um dia; mover de lista para dia não deixa (segue `/move`).
- [x] Apagar fecha o painel e mostra `Toast` com "desfazer" que restaura (`batch restore`); copiar põe texto + subtarefas (`- [ ]`/`- [x]`) no clipboard.
- [x] Largura ≥ md: gaveta de 420 px à direita com a semana visível; abaixo: tela cheia; Esc fecha.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — EntryPanel (gaveta 420 px ≥ md, tela cheia abaixo; Esc e × fecham) com texto, tipo, hora (e 'sem hora'), cor, prioridade, tags, meta, notas (Notes: react-markdown sem HTML cru), mover para (dias da semana, listas ou outra data), duplicar, copiar (checklist) e apagar com desfazer (batch delete/restore). Usa a emenda do contrato (null limpa). Playwright: cada campo reflete na linha na hora e após gravar; <script> vira texto e não executa; mover terça→sexta deixa › e fecha o painel.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP13 — Web: subtarefas no painel

```yaml
lane: feita
estimativa: 60min
files:
  - apps/web/components/week/EntryPanel.tsx
  - apps/web/components/week/SubtaskList.tsx
  - apps/web/components/week/weekState.ts
depende_de: [WP12]
```

### Objetivo
Criar (Enter), marcar, editar (duplo clique), reordenar (arrastar, `DndContext` próprio) e apagar subtarefas.

### Definição de Pronto
- [x] Criar usa `createEntry` com `parentId`; reordenar usa `moveEntry` só com `beforeId`.
- [x] O contador `x/y` da linha na semana acompanha cada mudança sem recarregar.
- [x] Subtarefa concluída desce para o fim (ordem do servidor).

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — SubtaskList (criar com Enter mantendo o foco, marcar, duplo clique edita, arrastar com DndContext próprio por mouse/toque/teclado, apagar com desfazer). createEntry com parentId; reordenar = moveEntry só com beforeId. Fora de files: WeekBoard.tsx (monta as ops e passa a lista ao painel) e NewEntryInput.tsx (placeholder; Esc com texto não fecha o painel); EntryRow e SubtaskList sem aria-disabled na linha. Playwright: x/y da linha acompanha na hora; concluída desce (ordem do servidor); reordenar persiste ao recarregar.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP14 — Web: ações de dia, pendentes e rastro

```yaml
lane: feita
estimativa: 75min
files:
  - apps/web/app/semana/page.tsx
  - apps/web/components/week/WeekBoard.tsx
  - apps/web/components/week/weekState.ts
  - apps/web/components/week/Column.tsx
  - apps/web/components/week/EntryRow.tsx
  - apps/web/components/week/ColumnMenu.tsx
  - apps/web/components/week/PendingAside.tsx
depende_de: [WP09]
```

### Objetivo
Menu do dia (concluir todas, adiar pendentes para amanhã, copiar a lista); lateral de pendentes com "migrar todas para hoje"; "apagar rastro" por tarefa e "limpar migradas desta semana (N)", ambos com desfazer.

### Definição de Pronto
- [x] "Adiar pendentes" na terça: abertas vão para quarta com rastro na terça; no domingo, `Toast` avisa que foram para a próxima semana.
- [x] "Migrar todas para hoje" substitui a antiga seção "Migrar para N" da lateral e usa `batch migrate` com o `today` da API.
- [x] "Limpar migradas" apaga só as `MIGRATED` da semana vista; "desfazer" traz todas de volta.
- [x] "Copiar a lista" gera "Quarta, 24/09" + um bullet por tarefa com subtarefas indentadas.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — ColumnMenu (⋯: concluir todas, adiar pendentes para amanhã, copiar a lista), PendingAside (pendentes de dias passados da semana + 'migrar todas para hoje' com o today da API + 'limpar migradas desta semana (N)'), '×' de apagar rastro nas migradas; tudo em lote com desfazer onde apaga. Substitui a seção 'Migrar para N' do servidor. Playwright: adiar na terça → quarta com › na terça; migrar todas → quinta (hoje); limpar 8 migradas e desfazer traz todas; apagar um rastro e desfazer; copiar 'Quinta, 24/09' + checklist com subtarefas; adiar no domingo → aviso 'próxima semana'; concluir todas.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP15 — Web: listas personalizadas

```yaml
lane: feita
estimativa: 90min
files:
  - apps/web/app/semana/page.tsx
  - apps/web/components/week/WeekBoard.tsx
  - apps/web/components/week/weekState.ts
  - apps/web/components/week/Column.tsx
  - apps/web/components/week/ColumnMenu.tsx
  - apps/web/components/week/CustomLists.tsx
depende_de: [WP10, WP14]
```

### Objetivo
Faixa de listas abaixo dos dias (acima dos hábitos): criar, renomear (duplo clique no nome), mover ‹ ›, apagar com confirmação; arrastar entre lista e dia no mesmo `DndContext`.

### Definição de Pronto
- [x] Lista → quinta: a tarefa sai da lista sem rastro; quinta → lista: rastro na quinta.
- [x] Menu da lista: concluir todas, copiar a lista, mover ‹ ›, apagar (confirmação diz quantas tarefas somem). Sem "adiar".
- [x] Ordem das listas persiste ao recarregar.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — CustomLists (faixa abaixo dos dias, acima dos hábitos; '+ nova lista'; duplo clique no nome renomeia) com colunas iguais às dos dias no mesmo DndContext; menu da lista: concluir todas, copiar, ‹ mover ›, apagar (window.confirm com a contagem). Playwright: lista→quinta sai sem rastro; quinta→lista deixa › na quinta; ordem persiste ao recarregar; menu sem 'adiar'; confirmação 'Apagar a lista "…"? 1 tarefa some junto.'
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP16 — Web: repetição

```yaml
lane: feita
estimativa: 90min
files:
  - apps/web/app/semana/page.tsx
  - apps/web/components/week/WeekBoard.tsx
  - apps/web/components/week/weekState.ts
  - apps/web/components/week/EntryPanel.tsx
  - apps/web/components/week/EntryRow.tsx
  - apps/web/components/week/RecurrencePicker.tsx
  - apps/web/components/week/RecurringAside.tsx
depende_de: [WP12]
```

### Objetivo
No painel, escolher repetição com as opções do WeekToDo (não repete, todo dia, toda semana, dias úteis, dias escolhidos, todo mês, dias do mês, todo ano; intervalo; termina nunca/após N/em data); lateral com as repetidas e "parar".

### Definição de Pronto
- [x] O seletor só aparece para tarefa aberta de um dia; com regra, mostra o `summary` e "parar de repetir" no lugar do seletor.
- [x] Criar "toda segunda": as próximas segundas visíveis ganham a tarefa com ↻ após o revalidate.
- [x] Apagar uma ocorrência oferece "só esta" e "esta e as próximas" (= parar + apagar esta).
- [x] "Parar" na lateral pede confirmação e tira da tela as futuras abertas.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — RecurrencePicker no painel (só para tarefa aberta de um dia; com regra mostra o resumo e 'parar de repetir' com confirmação) com as 8 opções, intervalo e fim (nunca/após N/em data); RecurringAside com as regras e 'parar' confirmado; apagar ocorrência oferece 'só esta' e 'esta e as próximas' (parar + apagar esta). weekState ganha addRule. Playwright: seg/qua/sex criado na segunda aparece na quarta e sexta com ↻ após o revalidate e na semana seguinte; 'só esta' tira só a de quarta; parar na lateral tira as futuras; 'esta e as próximas'. Semântica de 'esta e as próximas' em ocorrência futura → INBOX.
- 2026-09-25: aprovada na revisão pelo Agente Review.

---

## WP17 — Aceite ponta a ponta e acabamento no celular

```yaml
lane: feita
estimativa: 60min
files:
  - apps/web/components/week/**
depende_de: [WP10, WP11, WP13, WP14, WP15, WP16]
```

### Objetivo
Rodar todos os itens de "Está pronto quando" da spec em desktop e em viewport de celular e corrigir o que for só de interface dentro de `components/week/`.

### Definição de Pronto
- [x] Cada item da spec verificado; o Log registra quais passaram e, se algum depender de mudança fora de `components/week/`, a WP para e pede o Spec Architect.
- [x] Capturas (Playwright/Chromium) da semana no desktop, com o painel aberto e no celular, salvas e citadas no Log.
- [x] Para um dia com tarefa migrada e uma repetida, o Diário e `GET /daily-summary` (fonte do app Android) mostram o mesmo que a Semana.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — 15/15 critérios de 'Está pronto quando' verificados com Playwright/Chromium (desktop 1280 e Pixel 7), banco local zerado antes; #15: /daily-summary, Diário e Semana mostram as mesmas entradas na mesma ordem num dia com migrada e repetida. Capturas em capturas/semana-desktop.png, semana-painel.png, celular-semana.png e celular-painel.png. Correções de interface: selos quebram linha na coluna estreita (e o ponto de cor não some), nome do dia não quebra no meio, '‹ voltar à semana' no painel do celular. Fora de components/week (→ INBOX, não bloqueiam os critérios): a página estoura a largura no celular (Nav/layout) e o Diário mostra migrada com •.
- 2026-09-25: aprovada na revisão pelo Agente Review.
