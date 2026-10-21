# Tasks — 002-infra-ambientes

Lanes: planejado → fazendo → revisão → pronto. Contrato em `spec.md` e `plan.md` (Leia). Ordem: WP00 → (WP01 ∥ WP02) → WP03 → WP04 → WP05 → WP06.

### WP05 — Proteção e Environments
- Lane: planejado (aguarda autorização do usuário; PR #7 já mergeado em `development`; o commit `c895197` e as edições locais de infra ainda precisam de PR novo)
- Dono: Chewie
- Possui: configuração do GitHub (branches, Environments)
- Objetivo: proteção de `development` e `main` (PR, checks `node` e `android`, sem force push, sem bypass); Environments `qa` e `production` (revisor: Andre); apagar `prev` só com OK do usuário no momento.
- Aceite: critérios de `spec.md` sobre merge bloqueado com CI vermelho e push recusado em `main`.
- Evidência: configuração lida de volta e tentativa de push recusada.
- Depende de: WP03 mergeado; autorização do usuário.

### WP06 — Aceite
- Lane: planejado
- Dono: Ahsoka
- Possui: nenhum arquivo
- Objetivo: rodar todos os critérios de "Está pronto quando" da spec com os portais.
- Aceite: todos os itens de `spec.md` com evidência.
- Evidência: relatório por critério.
- Depende de: WP04, WP05
- Provas que a WP04 não produziu e a WP06 exige (lista da Ahsoka, 2026-10-21): primeiro `qa-reset.sh` real com `neonctl branches reset --parent` e data da branch atualizada; `/habits/today` com chave de QA devolvendo dados copiados e contagem de `User` em QA igual à de Produção; repositório `indice` só com imagens de Produção e nenhuma de QA; migração de teste aplicada só em QA; comportamento de falha de migração antes do deploy.
