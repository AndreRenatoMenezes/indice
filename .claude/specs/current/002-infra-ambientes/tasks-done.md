# Tasks concluídas — 002-infra-ambientes

### WP00 — Aposentar `prev`
- Lane: pronto
- Dono: Chewie
- Possui: branches (`prev`, `development`, `feat/002-infra-ambientes`)
- Fora de escopo: qualquer arquivo de produto
- Objetivo: `prev` entra em `development` e a feature 002 nasce de `development`.
- Aceite: PR `prev` → `development` mergeado com CI verde; `feat/002-infra-ambientes` criada a partir de `development` depois do merge; nada apagado.
- Evidência: URL do PR, estado do CI, `git log` de `development`.
- Depende de: autorização explícita do usuário para abrir e mergear o PR.

### WP01 — Pipeline parametrizado
- Lane: pronto (aprovada pela Ahsoka, 2026-10-20)
- Log: 2026-10-20 Obi (emenda) — `_REPO` documentada por ambiente (`indice`/`indice-qa`), passo `guard-tag` falha com `_TAG` vazia antes de construir; README: tabela de substituições por ambiente, repositório de QA, reset não rotaciona, seção de rotação da chave de QA.
- Log: 2026-10-20 Obi — `cloudbuild.yaml` com `_TAG` (obrigatória, sem padrão), `_SUFFIX`, `_WEB_AUTH`, nomes `indice-{api,web,migrate}${_SUFFIX}`, CORS pela URL da web (fallback `*`), `_WEB_ORIGIN` removida; README reescrito; linha de branches no `CLAUDE.md`. YAML parseado (ruby/Psych) e scripts dos passos com `bash -n`.
- Dono: Obi (DevOps)
- Possui: `infra/cloudrun/cloudbuild.yaml`, `infra/cloudrun/README.md`, linha de fluxo de branches em `CLAUDE.md`
- Fora de escopo: `infra/cloudrun/bootstrap.sh`, `qa-reset.sh` (WP02), `.github/workflows/**` (WP03)
- Objetivo: `cloudbuild.yaml` com `_SUFFIX`, `_TAG`, `_WEB_AUTH`, nomes de job e serviço por ambiente, CORS pela URL da web; README conforme `plan.md`.
- Aceite: critérios de `spec.md` sobre ordem de deploy, isolamento e README; nenhum segredo no diff; Produção mantém nomes e comportamento atuais.
- Evidência: diff, validação local do YAML, lista dos tópicos do README.
- Depende de: WP00

### WP02 — Scripts de bootstrap e reset
- Lane: pronto (aprovada pela Ahsoka, 2026-10-20)
- Log: 2026-10-20 Obi (achados da Ahsoka) — `bootstrap.sh`: provider WIF existente é conferido (issuer, `attributeMapping` exato com `attribute.environment`, `attributeCondition` com `assertion.repository`) e o script aborta se divergir, sem corrigir sozinho. `qa-reset.sh`: só aceita `NEON_BRANCH` vazia ou `qa`. Stubs: condição errada e mapping sem environment abortam, provider correto passa, ausente cria; `NEON_BRANCH` main/production/dev/staging recusada sem nenhuma chamada.
- Log: 2026-10-20 Obi (emenda) — `bootstrap.sh` cria `indice-qa`, aplica a limpeza nos dois repositórios e garante `cleanupPolicyDryRun` falso (sem `--no-dry-run`, que não existe no gcloud 585; ver `bloqueios.md`); confere `<email-usuario-app>` contra o `INDICE_USER_EMAIL` do job `indice-seed` (padrão `andre@indice.local`) e aborta se divergir. Teste com `gcloud`/`curl` falsos no bash 3.2.
- Log: 2026-10-20 Obi — `bootstrap.sh <email-web-qa> <email-usuario-app>` e `qa-reset.sh` (neonctl reset --parent → migrate → seed → rekey). `bash -n` limpo; script do rekey testado localmente com prisma trocado por `cat`. Nenhum recurso real criado.
- Dono: Obi (DevOps)
- Possui: `infra/cloudrun/bootstrap.sh`, `infra/cloudrun/qa-reset.sh` (novos)
- Fora de escopo: `cloudbuild.yaml`, README (WP01), workflows (WP03)
- Objetivo: bootstrap idempotente (WIF, SA, limpeza do Artifact Registry, nomes de secrets de QA, jobs seed-qa e rekey-qa, invoker por e-mail via argumento) e reset de QA (Neon → migrate → seed → rekey).
- Aceite: `bash -n` limpo; segredos lidos por stdin ou ambiente, nunca argumento nem arquivo; e-mail só por argumento; nenhum recurso real criado.
- Evidência: diff e saída da validação local.
- Depende de: WP00

### WP03 — Workflows
- Lane: pronto (aprovada pela Ahsoka, 2026-10-20)
- Log: 2026-10-20 Obi (emenda) — `deploy.yml` passa `_REPO=indice` em Produção e `_REPO=indice-qa` em QA.
- Log: 2026-10-20 Obi — `ci.yml` com `pull_request` + `workflow_call` (sem `push: main`); `deploy.yml` novo. YAML parseado (ruby/Psych), passo `run` com `bash -n`; actionlint não instalado.
- Dono: Obi (DevOps)
- Possui: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` (novo)
- Fora de escopo: `infra/**`
- Objetivo: `ci.yml` com `workflow_call`; `deploy.yml` com branch → ambiente, WIF, concurrency por ambiente sem cancelar, `vars.*` para identificadores.
- Aceite: critérios de `spec.md` sobre CI no commit mergeado, um deploy por vez e ausência de chave JSON; sintaxe validada localmente.
- Evidência: diff e saída do validador.
- Depende de: WP01

### WP04 — Provisionar (execução externa)
- Lane: pronto (aprovada pela Ahsoka, 2026-10-21; pendente só o print do console do Neon, scale to zero da branch `qa`, do usuário)
- Dono: Obi (executa) · usuário (autentica e confirma os gates)
- Log: 2026-10-21 Obi — passos 1-10: `PROVA_D`, `PROVA_C`, `PROVA_A`, `GATE_P7` (19/19), `GATE_P8` com a frase do usuário, `GATE_P10`, `PRE_MERGE` ok; branch Neon `qa` (`br-holy-dawn-acuxawm7`, filha de `production`); bootstrap `exit=0`; política de limpeza ok em `indice` e `indice-qa`; 3 variables do repositório.
- Log: 2026-10-21 Obi — correção A (papel `indiceBucketLister`, só `storage.buckets.list`): `PROVA_E`, `IDEMPOTENCIA_E` ok. Primeiro deploy de QA (Chewie, rerun do run 39610223744) SUCCESS. Passos 12-15: `PROVA_B` (sem tag e tag vazia recusadas), `imagens=sem-mudanca`, seed e rekey `succeeded`, `GATE_P13` (chaves cruzadas 200/401/200/401), `indice-web-qa` privado com `run.invoker` só do Andre (anônimo 403), `indice-api-qa` com `allUsers`, `IDEMPOTENCIA_14` ok, Produção sem revisão nova.
- Possui: nenhum arquivo
- Objetivo: branch Neon `qa`, `bootstrap.sh`, valores dos secrets de QA, seed + rekey, variables do repositório.
- Aceite: conforme `plan.md`.
- Evidência: provas em `~/indice-wp04-provas` (fora do repo, sem segredo).
- Depende de: WP02, WP03

