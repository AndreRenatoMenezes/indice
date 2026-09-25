---
feature: 001-lista-semanal
dominio: journal
tags: [semana, tarefas, arrastar-e-soltar, listas, recorrencia, weektodo]
status: pronto   # esclarecendo | pronto
criada_em: 2026-09-25
---

# Semana interativa: a lista semanal do WeekToDo no Índice

## Em uma frase

A página Semana deixa de ser só leitura: crio, edito, concluo, repito e arrasto tarefas entre dias e listas, como no WeekToDo.

## O que muda na prática

- **Hoje:** a Semana só exibe. Para criar, concluir ou editar é preciso ir ao Diário, dia a dia. Trocar de semana só com ‹ ›.
- **Depois:** cada dia é uma lista editável; abaixo dos dias ficam as listas personalizadas ("Algum dia", "Projetos"). Os detalhes da tarefa abrem num painel à direita (tela cheia no celular).
- **A hora manda na ordem:** tarefas com horário ficam no topo, em ordem de hora; arrastar reordena as sem hora; concluídas descem para o fim.
- **Tirar uma tarefa de um dia deixa rastro:** ela fica "migrada" (›, riscada) na origem e segue com as notas e as subtarefas abertas. Tirar de uma lista não deixa rastro. O rastro pode ser apagado, um a um ou a semana toda.
- **Atrasadas não andam sozinhas:** tarefas abertas de dias passados ficam onde estão até eu adiar ou migrar.

## O que o sistema precisa lembrar

- Uma tarefa repetida nasce de uma regra ("toda segunda", "dia 15 de cada mês") e aparece de hoje em diante; semanas passadas não ganham cópias retroativas.
- Cada ocorrência é uma tarefa independente: editar, concluir ou apagar muda só ela. Para mudar a regra, paro de repetir e crio de novo (como no WeekToDo).
- Parar de repetir apaga as ocorrências futuras ainda abertas; as passadas e as concluídas ficam.
- Apagar uma lista apaga as tarefas dela, depois de confirmação.

## Está pronto quando

- [ ] Digito no pé da quarta e aperto Enter: a tarefa aparece e o campo fica pronto para a próxima.
- [ ] Clico no marcador (•): a tarefa fica concluída. Clico de novo: reabre.
- [ ] Arrasto de segunda para sexta: na segunda fica o rastro (›) e a tarefa aparece na sexta com notas e subtarefas abertas.
- [ ] Arrasto uma tarefa sem hora para cima de outra no mesmo dia: a ordem fica ao recarregar. Tarefa com hora não sai do lugar dela.
- [ ] Apago o rastro de uma tarefa, ou "limpo as migradas" da semana, e posso desfazer.
- [ ] Troco de semana com ‹ ›, volto com "hoje" e salto para qualquer data num mini-calendário.
- [ ] Clique no texto abre o painel; duplo clique edita ali mesmo (Enter salva, Esc desiste).
- [ ] O painel tem: notas com formatação simples, subtarefas (criar, marcar, editar, reordenar, apagar), horário, cor, prioridade (*), tags, tipo (tarefa/evento/nota), meta vinculada, mudar de dia ou de lista, e repetição.
- [ ] Na semana, cada tarefa mostra hora, cor, prioridade, contador de subtarefas (1/3), sinal de nota e sinal de repetição (↻).
- [ ] Por tarefa: duplicar, copiar o texto e apagar com "desfazer". Por dia: concluir todas, adiar pendentes para amanhã, copiar a lista.
- [ ] A lateral lista as pendentes de dias passados, com "migrar todas para hoje", e as tarefas repetidas, com "parar".
- [ ] Crio, renomeio, reordeno e apago listas personalizadas; arrasto tarefas entre lista e dia, nos dois sentidos.
- [ ] Marco "toda segunda" numa tarefa: ela aparece nas próximas segundas; "parar de repetir" tira as futuras.
- [ ] No celular tudo funciona (arrastar com toque longo). Se uma gravação falhar, a tela volta ao estado anterior e aparece um aviso.
- [ ] O que faço na Semana aparece igual no Diário e no app Android, inclusive as repetições do dia.

## Não entra agora

- Alarmes e notificações no horário; aba semanal no Android; imprimir a semana; temas, zoom e colunas do WeekToDo.
- Repetição em tarefas de listas personalizadas (só tarefas de um dia repetem).

---

<details>
<summary>Detalhes técnicos (a IA lê, você não precisa)</summary>

**Decisões do usuário (2026-09-25):** 1B (a hora manda na ordem), 2B (sair de um dia deixa rastro ›, com opção de apagar o rastro), 3A (atrasadas só andam por ação explícita), 4C (listas personalizadas + recorrência entram nesta feature).

**Desdobramentos definidos pelo Spec Architect** (valem até o usuário mudar):
- Sair de uma lista personalizada não deixa rastro: lista não tem data, então nada foi "adiado".
- Só tarefa aberta muda de dia ou de lista. Concluída, migrada ou cancelada precisa ser reaberta antes; ainda abre no painel.
- Migrar leva só as subtarefas abertas; as concluídas ficam no rastro. É o comportamento atual do "migrar" do Diário e do Android, que continua igual.
- A ordem por hora já é a regra atual da API (1B não muda o Diário nem o Android).

**Restrições:**
- O navegador nunca chama a API: toda mudança passa por Server Action (`CLAUDE.md`). Resposta otimista, com reversão se a gravação falhar.
- Arrastar com mouse, toque e teclado.
- Não muda o banco: tarefa, lista, regra de recorrência e ocorrência por data já existem no modelo.
- Mudança no contrato compartilhado exige espelhar no Android (`Dto.kt`), mesmo sem tela nova lá.

**Achados da investigação (2026-09-25):**
- Editar tarefa ignora data e lista: não existe "mover"; não há reordenação em lote.
- A consulta por intervalo, usada pela Semana, devolve só tarefas-raiz, sem subtarefas.
- Apagar é lógico, então "desfazer" = restaurar. Falta essa operação.
- Recorrência: existe só a expansão pura de regras; nenhuma rota a usa, e nada materializa ocorrências.

**Cenários alternativos:**
- Soltar no mesmo lugar → nada acontece, nenhuma gravação.
- Tarefa com hora arrastada dentro do mesmo dia → volta ao lugar, com o aviso "a hora define a ordem".
- "Mudar de dia" pelo painel segue a mesma regra do arrasto (deixa rastro se sair de um dia).
- Ocorrência repetida levada para outro dia → rastro na origem, cópia sem repetição no destino; a regra não recria aquela data.
- "Adiar pendentes" no domingo → vão para a segunda seguinte (saem da tela, com aviso).
- Subtarefa só reordena dentro da tarefa. Apagar a tarefa some com as subtarefas; desfazer traz de volta.
- Evento e nota seguem as mesmas regras de criar, editar e arrastar.
- Criar com texto vazio → ignora. Apagar todo o texto ao editar → mantém o texto anterior.
- Duas abas ou dois aparelhos abrindo o mesmo dia → a repetição aparece uma vez só; nas edições, vale a última gravação.

**Referência no WeekToDo** (`AndreRenatoMenezes/weektodo-journal`): `toDoList.vue` (criar, soltar), `toDoItem.vue` + `activeToDo.vue` (concluir, apagar/desfazer), `views/toDoModal/toDoModal.vue` (detalhe, subtarefas), `views/toDoModal/repeatingEvent.vue` (opções de repetição), `views/RecurrentEventsModal.vue` (lista de repetidas), `listHeader.vue` (menu do dia), `layout/sideBar.vue` (hoje, calendário).

</details>
