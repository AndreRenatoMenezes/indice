# Tasks — 002-infra-ambientes

Lanes: planejado → fazendo → revisão → pronto. Contrato em `spec.md` e `plan.md` (Leia). Ordem: WP00 → (WP01 ∥ WP02) → WP03 → WP04 → WP05 → WP06.

### WP00 — Aposentar `prev`
- Lane: planejado
- Dono: Chewie
- Possui: branches (`prev`, `development`, `feat/002-infra-ambientes`)
- Fora de escopo: qualquer arquivo de produto
- Objetivo: `prev` entra em `development` e a feature 002 nasce de `development`.
- Aceite: PR `prev` → `development` mergeado com CI verde; `feat/002-infra-ambientes` criada a partir de `development` depois do merge; nada apagado.
- Evidência: URL do PR, estado do CI, `git log` de `development`.
- Depende de: autorização explícita do usuário para abrir e mergear o PR.

### WP01 — Pipeline parametrizado
- Lane: planejado
- Dono: DevOps (a recrutar)
- Possui: `infra/cloudrun/cloudbuild.yaml`, `infra/cloudrun/README.md`, linha de fluxo de branches em `CLAUDE.md`
- Fora de escopo: `infra/cloudrun/bootstrap.sh`, `qa-reset.sh` (WP02), `.github/workflows/**` (WP03)
- Objetivo: `cloudbuild.yaml` com `_SUFFIX`, `_TAG`, `_WEB_AUTH`, nomes de job e serviço por ambiente, CORS pela URL da web; README conforme `plan.md`.
- Aceite: critérios de `spec.md` sobre ordem de deploy, isolamento e README; nenhum segredo no diff; Produção mantém nomes e comportamento atuais.
- Evidência: diff, validação local do YAML, lista dos tópicos do README.
- Depende de: WP00

### WP02 — Scripts de bootstrap e reset
- Lane: planejado
- Dono: DevOps
- Possui: `infra/cloudrun/bootstrap.sh`, `infra/cloudrun/qa-reset.sh` (novos)
- Fora de escopo: `cloudbuild.yaml`, README (WP01), workflows (WP03)
- Objetivo: bootstrap idempotente (WIF, SA, limpeza do Artifact Registry, nomes de secrets de QA, jobs seed-qa e rekey-qa, invoker por e-mail via argumento) e reset de QA (Neon → migrate → seed → rekey).
- Aceite: `bash -n` limpo; segredos lidos por stdin ou ambiente, nunca argumento nem arquivo; e-mail só por argumento; nenhum recurso real criado.
- Evidência: diff e saída da validação local.
- Depende de: WP00

### WP03 — Workflows
- Lane: planejado
- Dono: DevOps
- Possui: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` (novo)
- Fora de escopo: `infra/**`
- Objetivo: `ci.yml` com `workflow_call`; `deploy.yml` com branch → ambiente, WIF, concurrency por ambiente sem cancelar, `vars.*` para identificadores.
- Aceite: critérios de `spec.md` sobre CI no commit mergeado, um deploy por vez e ausência de chave JSON; sintaxe validada localmente.
- Evidência: diff e saída do validador.
- Depende de: WP01

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
