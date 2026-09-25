# Tasks — 001-lista-semanal

<!-- WPs vivas apenas. Ao aprovar, o Review Agent move o bloco inteiro para tasks-done.md. -->
<!-- Ordem sugerida: WP01–WP07 (API) → WP08 → WP09 → as demais web conforme `depende_de`. WP02 e WP05 não dependem de rota nenhuma; WP11 só precisa da WP08. -->

## WP01 — Contratos compartilhados e espelho no Android

```yaml
lane: revisão
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
- [ ] `EntryDto` tem `recurrenceRuleId`; `toEntryDto` preenche o campo; `Dto.kt` espelha (`String? = null`).
- [ ] `UpdateEntryInput`, `MoveEntryInput`, `EntryBatchInput`, `RecurrenceInput`, `RecurrenceRuleDto`, `CustomListDto`, `CreateListInput`, `UpdateListInput`, `ReorderListsInput` exportados com os tipos inferidos, exatamente como no plano.
- [ ] `PATCH /entries/:id` não copia mais `position`; `curl -X PATCH … -d '{"position":3}'` não altera a posição.
- [ ] Bug corrigido: `PATCH {"status":"DONE"}` num `EVENT` mantém `kind: "EVENT"` (antes virava `TASK` pelo default do zod).

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — contratos novos no shared; EntryDto/Dto.kt com recurrenceRuleId; PATCH sem position e sem default de kind (EVENT concluído segue EVENT, verificado por curl). assembleDebug não roda aqui (SDK do Android bloqueado pela rede): fica para o job android do CI.

---

## WP02 — Regras puras: ordem e movimento

```yaml
lane: revisão
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
- [ ] `sortEntries` inalterado e coberto por teste que trava a regra 1B.
- [ ] Testes de `reposition`: antes de manual; `beforeId` com hora ou fechado → fim das manuais; `beforeId` nulo → fim das manuais; item com hora → `[]`; só devolve posições que mudaram.
- [ ] Testes de `moves`: 3 casos de `moveKind`; `canLeaveCollection` falso para fechada e para subtarefa; `migrationCopy` leva só subtarefas `OPEN`, seta `migratedFromId` e não leva regra; `duplicateCopy` reabre todas as subtarefas.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — ordering.ts (isClosed, isManual, reposition; sortEntries intocado e travado por teste) e moves.ts (moveKind, canLeaveCollection, migrationCopy, duplicateCopy); 19 testes vitest.

---

## WP03 — API: árvore com subtarefas e `POST /entries/:id/move`

```yaml
lane: revisão
estimativa: 90min
files:
  - apps/api/src/routes/entries.ts
depende_de: [WP01, WP02]
```

### Objetivo
Consultas por intervalo e por lista devolvem árvore; mover/reordenar/migrar/realocar num endpoint só; `/migrate` vira atalho dele.

### Definição de Pronto
- [ ] Um helper único de árvore (raízes + `children` ordenados) atende `?date=`, `?from&to` e `?collectionId=`; intervalo > 62 dias → 400.
- [ ] `/move` segue os 7 passos do plano, numa transação; 409 para fechada/subtarefa saindo da coleção; 400 para `date`/`collectionId` em subtarefa; 404 para lista alheia ou apagada.
- [ ] Roteiro `curl`: mover de um dia para outro deixa origem `MIGRATED` e cópia com as subtarefas abertas; mover de lista para dia mantém o id e leva todas as subtarefas; reordenar sem hora persiste; reordenar com hora não muda nada.
- [ ] `POST /entries/:id/migrate` continua respondendo 201 com a cópia (Diário e Android seguem funcionando).

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — entryTree único para ?date/?from&to/?collectionId (from e to obrigatórios juntos, teto 62 dias); moveEntry (reorder/migrate/relocate numa transação) atende /move e /migrate (201; 409 se fechada ou subtarefa). Roteiro curl ok: seg→sex deixa › e leva só subtarefas abertas; lista→dia mantém id e todas; reordenar com hora não muda nada.

---

## WP04 — API: lote e duplicar

```yaml
lane: revisão
estimativa: 60min
files:
  - apps/api/src/routes/entries.ts
depende_de: [WP03]
```

### Objetivo
`POST /entries/batch` (complete, migrate, delete, restore) e `POST /entries/:id/duplicate`.

### Definição de Pronto
- [ ] `batch` responde `{ ids }` só com os afetados e nunca toca entradas de outro usuário (testar com id inexistente/alheio no meio da lista).
- [ ] `migrate` em lote usa o mesmo caminho do `/move` (rastro + cópia), em ordem de posição, numa transação; ignora ids fechados.
- [ ] `delete` seguido de `restore` com os mesmos ids devolve a tarefa com status e subtarefas intactos.
- [ ] `duplicate`: 400 para subtarefa; cópia `OPEN` no fim, subtarefas reabertas, sem regra nem `migratedFromId`.

### Log
- 2026-09-25: iniciada
- 2026-09-25: concluída — POST /entries/batch (complete/migrate/delete/restore; só ids do usuário, responde os afetados; migrate usa migrateInto/relocateInto em ordem de data e posição, numa transação) e POST /entries/:id/duplicate (400 subtarefa). curl: delete+restore devolve status e subtarefas intactos; id inexistente e fechada ignorados.

---

## WP05 — Regras puras: recorrência

```yaml
lane: planejado
estimativa: 75min
files:
  - apps/api/src/modules/journal/recurrence.ts
  - apps/api/src/modules/journal/recurrence.test.ts
depende_de: [WP01]
```

### Objetivo
`buildRRule`, `ruleEndDate`, `describeRule` e `plannedOccurrences` conforme o plano, compatíveis com o `occurrencesBetween` existente.

### Definição de Pronto
- [ ] Para cada `freq` (com e sem `weekdays`/`monthDays`, com `interval` > 1), `occurrencesBetween` sobre a RRULE gerada devolve as datas esperadas num intervalo fixo.
- [ ] `COUNT` e `UNTIL` respeitados; `ruleEndDate` bate com a última ocorrência; dia 31 é pulado em meses curtos.
- [ ] `describeRule` produz os textos-exemplo do plano (pt-BR, com sufixos de fim).
- [ ] `plannedOccurrences` pula pares já existentes e nada antes de `from`.

### Log

---

## WP06 — API: rotas de recorrência e materialização na leitura

```yaml
lane: planejado
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
- [ ] `recurrence.ts` não importa nada de `entries.ts`.
- [ ] Criar regra "toda segunda" numa tarefa: `GET /entries?from&to` das próximas 2 semanas mostra as segundas com `recurrenceRuleId`; repetir o GET não duplica; semana passada não ganha ocorrências.
- [ ] Duas chamadas simultâneas ao mesmo intervalo (`curl … & curl …`) resultam em uma ocorrência por data.
- [ ] Apagar uma ocorrência não a recria; migrar uma ocorrência deixa rastro e a cópia sem regra.
- [ ] `DELETE /recurrence-rules/:id` apaga as futuras abertas e solta a regra das passadas/concluídas; `GET /daily-summary` de uma segunda futura mostra a ocorrência antes de parar e não depois.
- [ ] `schema.md`: descrição do `template` atualizada; `atualizado_em` muda.

### Log

---

## WP07 — API: listas personalizadas e README

```yaml
lane: planejado
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
- [ ] `GET /lists` traz as entradas de cada lista em árvore, na ordem de `sortOrder`.
- [ ] `DELETE /lists/:id` some com a lista e as tarefas dela (não aparecem mais em `GET /lists` nem em `?collectionId=`).
- [ ] `PUT /lists/order` ignora ids de outro usuário.
- [ ] README: linha da tabela de endpoints do journal cobre `move`, `batch`, `duplicate`, `/lists`, `/recurrence-rules` e `PUT /entries/:id/recurrence`.

### Log

---

## WP08 — Web: dependências e camada de dados

```yaml
lane: planejado
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
- [ ] `npm install` feito na raiz (lockfile regenerado pela ferramenta, não à mão).
- [ ] Todas as actions de journal (antigas e novas) chamam `revalidateJournal()` (`/` e `/semana`).
- [ ] `monthGrid("2026-02-11")` devolve semanas seg–dom cobrindo fevereiro inteiro (conferir no REPL/`tsx`).

### Log

---

## WP09 — Web: quadro semanal editável (sem arrastar)

```yaml
lane: planejado
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
- [ ] A página busca em paralelo semana, listas, regras e metas (plano, seção Web) e o estado do `WeekBoard` já guarda listas e regras, mesmo antes de exibi-las (WP12, WP15 e WP16 dependem disso).
- [ ] Hábitos, sequência, metas e coleções continuam renderizados no servidor e entram como slots (sem regressão visual na página).
- [ ] Enter no pé da quarta cria e mantém o foco; texto vazio é ignorado; Esc limpa.
- [ ] Clique no marcador conclui/reabre; clique no texto (após 250 ms) chama `onOpen` (painel vem na WP12); duplo clique edita inline; texto vazio mantém o anterior.
- [ ] Selos: hora, bolinha de cor, `*` por prioridade, `x/y` de subtarefas, ¶ se há nota, ↻ se há regra.
- [ ] Com a API parada, criar uma tarefa: ela some e o `Toast` avisa.

### Log

---

## WP10 — Web: arrastar e soltar entre dias e no mesmo dia

```yaml
lane: planejado
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
- [ ] Só raízes `OPEN` são arrastáveis; migradas/concluídas/canceladas não.
- [ ] Segunda → sexta: na hora aparece › na segunda e a cópia na sexta; após o revalidate, igual.
- [ ] Mesmo dia, sem hora: nova ordem persiste; com hora: volta ao lugar + `Toast` "a hora define a ordem"; soltar no mesmo lugar não chama a action.
- [ ] Teclado: foco na tarefa, espaço pega, setas movem, espaço solta.
- [ ] Viewport de celular (DevTools): toque longo arrasta; toque curto rola a página.

### Log

---

## WP11 — Web: hoje e mini-calendário

```yaml
lane: planejado
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
- [ ] "hoje" leva a `/semana` sem `date`; ‹ › mantêm o comportamento atual.
- [ ] Calendário abre no mês da semana vista, destaca a semana e o dia de hoje (vindo da prop, não do relógio do navegador), navega entre meses e, ao clicar num dia, vai para a semana dele.
- [ ] Fecha com Esc e com clique fora; utilizável no celular.

### Log

---

## WP12 — Web: painel de detalhes

```yaml
lane: planejado
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
- [ ] Cada campo grava ao mudar/sair e reflete na linha da semana na hora.
- [ ] Notas: editar em textarea, ver renderizado com `react-markdown` (sem HTML cru); `<script>` digitado aparece como texto.
- [ ] "Mover para" um dia deixa rastro se a origem for um dia; mover de lista para dia não deixa (segue `/move`).
- [ ] Apagar fecha o painel e mostra `Toast` com "desfazer" que restaura (`batch restore`); copiar põe texto + subtarefas (`- [ ]`/`- [x]`) no clipboard.
- [ ] Largura ≥ md: gaveta de 420 px à direita com a semana visível; abaixo: tela cheia; Esc fecha.

### Log

---

## WP13 — Web: subtarefas no painel

```yaml
lane: planejado
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
- [ ] Criar usa `createEntry` com `parentId`; reordenar usa `moveEntry` só com `beforeId`.
- [ ] O contador `x/y` da linha na semana acompanha cada mudança sem recarregar.
- [ ] Subtarefa concluída desce para o fim (ordem do servidor).

### Log

---

## WP14 — Web: ações de dia, pendentes e rastro

```yaml
lane: planejado
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
- [ ] "Adiar pendentes" na terça: abertas vão para quarta com rastro na terça; no domingo, `Toast` avisa que foram para a próxima semana.
- [ ] "Migrar todas para hoje" substitui a antiga seção "Migrar para N" da lateral e usa `batch migrate` com o `today` da API.
- [ ] "Limpar migradas" apaga só as `MIGRATED` da semana vista; "desfazer" traz todas de volta.
- [ ] "Copiar a lista" gera "Quarta, 24/09" + um bullet por tarefa com subtarefas indentadas.

### Log

---

## WP15 — Web: listas personalizadas

```yaml
lane: planejado
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
- [ ] Lista → quinta: a tarefa sai da lista sem rastro; quinta → lista: rastro na quinta.
- [ ] Menu da lista: concluir todas, copiar a lista, mover ‹ ›, apagar (confirmação diz quantas tarefas somem). Sem "adiar".
- [ ] Ordem das listas persiste ao recarregar.

### Log

---

## WP16 — Web: repetição

```yaml
lane: planejado
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
- [ ] O seletor só aparece para tarefa aberta de um dia; com regra, mostra o `summary` e "parar de repetir" no lugar do seletor.
- [ ] Criar "toda segunda": as próximas segundas visíveis ganham a tarefa com ↻ após o revalidate.
- [ ] Apagar uma ocorrência oferece "só esta" e "esta e as próximas" (= parar + apagar esta).
- [ ] "Parar" na lateral pede confirmação e tira da tela as futuras abertas.

### Log

---

## WP17 — Aceite ponta a ponta e acabamento no celular

```yaml
lane: planejado
estimativa: 60min
files:
  - apps/web/components/week/**
depende_de: [WP10, WP11, WP13, WP14, WP15, WP16]
```

### Objetivo
Rodar todos os itens de "Está pronto quando" da spec em desktop e em viewport de celular e corrigir o que for só de interface dentro de `components/week/`.

### Definição de Pronto
- [ ] Cada item da spec verificado; o Log registra quais passaram e, se algum depender de mudança fora de `components/week/`, a WP para e pede o Spec Architect.
- [ ] Capturas (Playwright/Chromium) da semana no desktop, com o painel aberto e no celular, salvas e citadas no Log.
- [ ] Para um dia com tarefa migrada e uma repetida, o Diário e `GET /daily-summary` (fonte do app Android) mostram o mesmo que a Semana.

### Log
