# Tasks — 002-infra-ambientes

Lanes: planejado → fazendo → revisão → pronto. Contrato em `spec.md` e `plan.md` (Leia). Ordem: WP00 → (WP01 ∥ WP02) → WP03 → WP04 → WP05 → WP06.

### WP04 — Provisionar (execução externa)
- Lane: planejado
- Dono: usuário (ou DevOps com autorização explícita)
- Possui: nenhum arquivo
- Objetivo: branch Neon `qa`, `bootstrap.sh`, valores dos secrets de QA, seed + rekey, variables do repositório.
- Aceite: conforme `plan.md`.
- Evidência: saída dos comandos sem valores secretos.
- Depende de: WP02, WP03

### WP05 — Proteção e Environments
- Lane: planejado
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
