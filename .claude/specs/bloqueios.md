# Bloqueios

Executor anexa antes de improvisar. Maestro varre a cada ciclo e roteia: contrato vai ao Arquiteto, orquestração é do Maestro, decisão cara vai ao usuário.

Entrada: data · agente · bloqueio em uma linha · escopo afetado · o que segue andando · dono da decisão · resolução e evidência (quando resolvido).


## 2026-10-20 · Chewie · WP00
- **Bloqueio:** comandos `git`/`gh` negados por falta de aprovação interativa no terminal do Chewie (Copilot); nenhum PR aberto.
- **Escopo afetado:** WP00 e, por dependência, WP01 a WP03.
- **Segue andando:** nada (cadeia depende da WP00).
- **Dono da decisão:** usuário (aprovar permissões no terminal do Chewie).
- **Resolução:** resolvido 2026-10-20. Chewie recebeu a aprovação do usuário; PR #6 mergeado (8b01d10), `feat/002-infra-ambientes` criada, commit a6b98a9.
- **Nota:** o worktree tem os arquivos de spec da 002 e `INBOX.md`/`ROADMAP.md` não commitados em `prev`. Proposta: depois do merge, criar `feat/002-infra-ambientes` de `development` levando esses arquivos e commitá-los como primeiro commit `docs(specs)`.

## 2026-10-20 · Obi · WP02 (emenda)
- **Bloqueio:** a emenda pede `set-cleanup-policies --no-dry-run`, mas o gcloud instalado (585.0.0) só define `--dry-run` (`store_true` em `lib/surface/artifacts/repositories/set_cleanup_policies.yaml`); `--no-dry-run` daria "unrecognized arguments". Sem a flag, o comando (read-modify-update) mantém o `cleanupPolicyDryRun` que o repositório já tiver.
- **Escopo afetado:** WP02 (`bootstrap.sh`), prova (a) da WP04.
- **Segue andando:** tudo; o intento (política efetiva) foi mantido.
- **Dono da decisão:** Leia (confirmar o desvio de forma).
- **Resolução:** `bootstrap.sh` aplica a política sem a flag, lê `cleanupPolicyDryRun` e, se `True`, desliga por PATCH na API REST (`updateMask=cleanupPolicyDryRun`, token por `gcloud auth print-access-token` via `-H @<(...)`, fora dos argumentos); imprime o valor final por repositório. A prova (a) da WP04 continua valendo como está.
- **Decisão da Leia (2026-10-20):** desvio aprovado; o contrato exige o resultado (`cleanupPolicyDryRun` falso em `indice` e `indice-qa`), não a flag. Fechado.
