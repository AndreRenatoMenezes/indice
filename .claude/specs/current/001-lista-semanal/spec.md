---
feature: 001-lista-semanal
dominio: journal
tags: [semana, tarefas, arrastar-e-soltar, weektodo]
status: esclarecendo   # esclarecendo | pronto
criada_em: 2026-09-25
---

# Semana interativa: a lista semanal do WeekToDo no Índice

## Em uma frase

A página Semana deixa de ser só leitura: crio, edito, concluo e arrasto tarefas entre os dias ali mesmo, como no WeekToDo.

## ⚠️ Preciso da sua decisão

1. **Dentro de um dia, quem manda na ordem: o horário ou a ordem em que eu arrastar?**
   - **A)** A ordem em que eu arrastar; concluídas descem para o fim → controle total / uma tarefa das 8h pode ficar abaixo de outra sem hora.
   - **B)** O horário: tarefas com hora no topo, em ordem; arrastar só reordena as sem hora → agenda sempre coerente / às vezes o arrasto "não obedece".
   - *Recomendo A, que é o padrão do WeekToDo. A mesma ordem vale no Diário e no Android.*
2. **Arrastar para outro dia deixa rastro no dia de origem?**
   - **A)** Não, a tarefa só muda de dia → lista limpa / não fica registro do adiamento.
   - **B)** Sim, fica "migrada" (›) na origem → histórico de adiamentos / dias passados cheios de ›.
   - *Recomendo A: arrastar é reorganizar, e "migrar" continua como ação explícita.*
3. **O que acontece com tarefas abertas em dias que já passaram?**
   - **A)** Ficam onde estão; cada dia tem "adiar pendentes para amanhã" e a lateral tem "migrar todas" → você decide / um clique a mais.
   - **B)** Vão sozinhas para hoje ao abrir a semana, como no WeekToDo → zero esforço / some a noção do que atrasou.
   - *Recomendo A, porque é o espírito Bullet Journal do Índice.*
4. **Quais extras do WeekToDo entram já?**
   - **A)** Nenhum → a semana chega antes / listas e recorrência viram as próximas features.
   - **B)** Listas personalizadas ("Algum dia", "Projetos") com arrastar entre lista e dia → mais paridade / ~40% a mais de trabalho.
   - **C)** Listas + tarefas recorrentes ("toda segunda") → paridade completa / quase o dobro.
   - *Recomendo A: entrega a semana logo, e as outras duas reaproveitam o que for feito aqui.*

## O que muda na prática

- **Hoje:** a Semana só exibe. Para criar, concluir ou editar é preciso ir ao Diário, dia a dia. Trocar de semana só com ‹ ›.
- **Depois:** cada dia é uma lista editável. Os detalhes da tarefa abrem num painel à direita (tela cheia no celular), sem esconder a semana.

## Está pronto quando

- [ ] Digito no pé da quarta e aperto Enter: a tarefa aparece e o campo fica pronto para a próxima.
- [ ] Clico no marcador (•): a tarefa fica concluída. Clico de novo: reabre.
- [ ] Arrasto de segunda para sexta, ou para outra posição no mesmo dia: continua assim ao recarregar, com as subtarefas junto.
- [ ] Troco de semana com ‹ ›, volto com "hoje" e salto para qualquer data num mini-calendário.
- [ ] Duplo clique no texto edita ali mesmo; Enter salva, Esc desiste.
- [ ] O painel tem: notas com formatação simples, subtarefas (criar, marcar, editar, reordenar, apagar), horário, cor, prioridade (*), tags, tipo (tarefa/evento/nota), meta vinculada e mudar de dia.
- [ ] Na semana, cada tarefa mostra hora, cor, prioridade, contador de subtarefas (1/3) e um sinal de que tem nota.
- [ ] Por tarefa: duplicar, copiar o texto e apagar com "desfazer" por alguns segundos. Por dia: concluir todas, adiar pendentes para amanhã, copiar a lista.
- [ ] No celular tudo funciona; se arrastar não for prático, mudo o dia pelo painel.
- [ ] Se a gravação falhar no meio de um arrasto, a tarefa volta ao lugar e aparece um aviso.
- [ ] O que faço na Semana aparece igual no Diário e no app Android.

## Não entra agora

- Alarmes e notificações no horário (o Índice ainda não tem notificações).
- Listas personalizadas e tarefas recorrentes (salvo decisão 4), aba semanal no Android, imprimir a semana, temas/zoom/colunas do WeekToDo.

---

<details>
<summary>Detalhes técnicos (a IA lê, você não precisa)</summary>

**Restrições:**
- O navegador nunca chama a API: toda mudança passa por Server Action (`CLAUDE.md`). Arrastar exige resposta otimista, com reversão se a gravação falhar.
- Arrastar com mouse **e** toque. Alternativa por teclado é desejável (o plano detalha).
- Não deve precisar mudar o banco: a tarefa já guarda notas, subtarefas, horário, cor, prioridade, tags, posição e meta. Se o plano concluir o contrário, a spec volta para cá.
- Mudança no contrato compartilhado exige espelhar no Android (`Dto.kt`), mesmo sem tela nova lá.

**Achados da investigação (insumo do plano, 2026-09-25):**
- Editar tarefa hoje ignora data e lista: não existe "mover para outro dia" (nem levar as subtarefas junto).
- Não há reordenação em lote; a posição só muda item a item.
- A consulta por intervalo, usada pela Semana, devolve só tarefas-raiz, sem subtarefas. A consulta de um dia traz.
- Apagar já é lógico (fica marcado como apagado), então "desfazer" = restaurar. Falta essa operação.
- A ordenação automática portada do WeekToDo põe tarefas com hora à frente da posição manual, o que conflita com a decisão 1-A.
- Recorrência: existe só a regra pura de expansão; nenhuma rota a usa (pesa na decisão 4-C).
- A web não tem biblioteca de arrastar e é quase toda Server Component. A Semana passa a ser mista (casca no servidor, colunas no cliente).

**Depende de:** nada externo.

**Cenários alternativos:**
- Soltar no mesmo lugar → nada acontece, nenhuma gravação.
- Tarefa migrada (›) ou cancelada → aparece riscada e não arrasta, mas abre no painel.
- Mover para fora da semana visível → só pelo "mudar de dia" no painel.
- Subtarefa não vai sozinha para outro dia; só reordena dentro da tarefa.
- Evento e nota seguem as mesmas regras de criar/editar/arrastar da tarefa.
- Criar com texto vazio → ignora. Apagar todo o texto ao editar → mantém o texto anterior.
- Duas abas abertas → vale a última gravação; ao recarregar, a semana reflete o servidor.

**Referência no WeekToDo** (`AndreRenatoMenezes/weektodo-journal`): `toDoList.vue` (criar, soltar), `toDoItem.vue` + `activeToDo.vue` (concluir, apagar/desfazer), `views/toDoModal/toDoModal.vue` (detalhe, subtarefas arrastáveis), `listHeader.vue` (menu do dia: concluir todas, adiar, copiar), `layout/sideBar.vue` (hoje, calendário).

</details>
