# Bloqueios

Executor anexa antes de improvisar. Maestro varre a cada ciclo e roteia: contrato vai ao Arquiteto, orquestração é do Maestro, decisão cara vai ao usuário.

Entrada: data · agente · bloqueio em uma linha · escopo afetado · o que segue andando · dono da decisão · resolução e evidência (quando resolvido).


## 2026-10-20 · Chewie · WP00
- **Bloqueio:** comandos `git`/`gh` negados por falta de aprovação interativa no terminal do Chewie (Copilot); nenhum PR aberto.
- **Escopo afetado:** WP00 e, por dependência, WP01 a WP03.
- **Segue andando:** nada (cadeia depende da WP00).
- **Dono da decisão:** usuário (aprovar permissões no terminal do Chewie).
- **Resolução:** aberto.
- **Nota:** o worktree tem os arquivos de spec da 002 e `INBOX.md`/`ROADMAP.md` não commitados em `prev`. Proposta: depois do merge, criar `feat/002-infra-ambientes` de `development` levando esses arquivos e commitá-los como primeiro commit `docs(specs)`.
