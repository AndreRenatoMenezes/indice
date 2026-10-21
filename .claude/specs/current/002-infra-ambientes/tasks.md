# Tasks — 002-infra-ambientes

Lanes: planejado → fazendo → revisão → pronto. Contrato em `spec.md` e `plan.md` (Leia). Ordem: WP00 → (WP01 ∥ WP02) → WP03 → WP04 → WP05 → WP06.

### WP04 — Provisionar (execução externa)
- Lane: fazendo (passos 1-10 pelo Obi, com autorização do usuário em 2026-10-21; logins e confirmações digitados pelo usuário; passo 11 em diante só com nova autorização)
- Dono: Obi (executa) · usuário (autentica e confirma os gates)
- Possui: nenhum arquivo
- Objetivo: branch Neon `qa`, `bootstrap.sh`, valores dos secrets de QA, seed + rekey, variables do repositório.
- Aceite: conforme `plan.md`.
- Evidência: saída dos comandos sem valores secretos.
- Depende de: WP02, WP03
- Log:
  - 2026-10-21 · Obi: passos 1-10 concluídos. `PROVA_D=ok`, `PROVA_C=ok`, branch Neon `qa` criada (`br-holy-dawn-acuxawm7`, filha de `production`), `GATE_P7=ok` (19/19), `GATE_P8=ok` com frase do usuário, bootstrap `exit=0`, política ok em `indice` e `indice-qa`, `PROVA_A=ok`, variables `GCP_PROJECT_ID`/`GCP_WIF_PROVIDER`/`GCP_DEPLOY_SA` criadas (`GATE_P10=ok`), `PRE_MERGE=ok`. Desvios do roteiro (neonctl 8, Keychain, gate 7 por condição, null no describe, inventário) aprovados por Luke e revisados pela Ahsoka; registro em `bloqueios.md`. Provas em `~/indice-wp04-provas` (fora do repo, sem segredo). Parado antes do passo 11.

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
