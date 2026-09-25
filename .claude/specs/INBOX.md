# Inbox

Ideias, bugs e dívidas soltas. **Uma linha cada.** Sem detalhamento — quando
virar feature, o Spec Architect abre uma spec.

## Ideias
- Imprimir / exportar a semana em PDF (o WeekToDo tem "PDF / Imprimir").
- Alarme no horário da tarefa: o campo existe no modelo, sem uso; depende de ter notificações.
- Editar a regra de uma repetição já criada (hoje: parar e criar de novo).

## Bugs
- No celular a página inteira estoura a largura (~680 px num aparelho de 412): o `Nav` (6 links em linha + data) e o `px-12` do layout não encolhem — vale para todas as páginas, não só a Semana.

## Dívidas técnicas
- Rotas da API sem teste automatizado: só módulos puros têm vitest; o CI já sobe Postgres, dá para testar com `app.inject`.
