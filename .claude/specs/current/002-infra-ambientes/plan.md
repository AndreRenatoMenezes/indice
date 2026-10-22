---
feature: 002-infra-ambientes
status: aprovado   # rascunho | aprovado
baseado_em_spec_de: 2026-10-20
---

# Plano — Ambientes QA e Produção com deploy automático

Delta sobre o que existe. Banco (`schema.md`) não muda: nenhuma migração nesta feature.

## Estado verificado (2026-10-20)

- GCP: projeto `indice-509203`, região `southamerica-east1`. Serviços `indice-api`, `indice-web`; jobs `indice-migrate`, `indice-seed`. **Nenhum pool de Workload Identity.**
- `infra/cloudrun/cloudbuild.yaml` já faz build → push → migração por job → deploy API → deploy web, parametrizado por secrets (`_DB_SECRET`, `_DB_DIRECT_SECRET`, `_API_KEY_SECRET`). Nomes de serviço/job são fixos, e a tag usa `$SHORT_SHA`, que só existe em gatilho do Cloud Build (vazio em `gcloud builds submit`).
- `ci.yml`: jobs `node` (Postgres de serviço, typecheck/test/build) e `android` (`assembleDebug`); roda em `pull_request` e push em `main`.
- Repositório **público** (`AndreRenatoMenezes/indice`): proteção de branch e ambientes com revisor obrigatório são gratuitos; artefatos e logs do Actions são visíveis.
- API em `NODE_ENV=production` recusa a chave de dev; precisa do seed por ambiente. `/health` é público.
- `prev` está 22 commits à frente de `main` (a 001 inteira vive lá); `main` recebeu PRs de `prev` e de `development`.

## Abordagem

**GitHub Actions orquestra, Cloud Build executa.** Um workflow `deploy.yml` reage a push em `development` (ambiente `qa`) e em `main` (ambiente `production`), chama o `ci.yml` como workflow reutilizável sobre o mesmo commit e, se verde, autentica no GCP por WIF e roda `gcloud builds submit --config infra/cloudrun/cloudbuild.yaml` com as substituições do ambiente. Reaproveita o pipeline que já funciona (migração antes da revisão incluída) e mantém o deploy manual possível pelo mesmo arquivo.

**Ambiente = sufixo + segredos.** O `cloudbuild.yaml` ganha `_SUFFIX` (`""` em Produção, `-qa` em QA) aplicado a serviços e jobs (`indice-api${_SUFFIX}`, `indice-web${_SUFFIX}`, `indice-migrate${_SUFFIX}`) e `_TAG` (SHA completo do commit, passado pelo workflow) no lugar de `$SHORT_SHA`. Secrets de QA: `indice-qa-database-url`, `indice-qa-database-url-direct`, `indice-qa-api-key`. Produção mantém os nomes atuais — nada muda para ela além do gatilho.

**Banco:** branch Neon `qa` no mesmo projeto Neon, **filha da principal** (cópia dos dados de Produção, decisão do usuário); Produção continua na principal. Endpoint de compute próprio da `qa`, com autosuspend.

**Mitigação da cópia de dados reais (mínima, sem código de app):**
- **Web de QA fechada por IAM.** `indice-web-qa` sobe com `--no-allow-unauthenticated` e `--ingress all`; só a conta Google do Andre tem `roles/run.invoker` nela. Acesso pelo Mac com `gcloud run services proxy indice-web-qa --region southamerica-east1 --port 3100` (3000 está ocupada). Custo zero; perde acesso pelo celular ao web de QA. A web de QA continua chamando a API de QA pela URL pública com a chave de QA — sem mudança em `apps/web`.
- **API de QA continua pública** (o APK precisa dela), protegida pela chave de QA. A cópia traz a linha `ApiKey` da chave de Produção; o seed só faz *upsert* (não remove), então o passo de "rekey" apaga em `qa` toda `ApiKey` cujo hash não seja o da chave de QA. Roda como Cloud Run Job `indice-rekey-qa` (imagem da API, `prisma db execute --stdin` pela conexão direta de QA), depois do `indice-seed-qa`. O rekey **não rotaciona** a chave de QA: ela é o valor `latest` de `indice-qa-api-key`. Rotacionar = `gcloud secrets versions add indice-qa-api-key` + executar `indice-seed-qa` e `indice-rekey-qa` + regerar o APK de QA.
- **Seed de QA no usuário copiado.** O seed faz `upsert` de `User` por e-mail (`INDICE_USER_EMAIL`); com e-mail diferente do da Produção ele cria um usuário novo e vazio, e a chave de QA abre só esse vazio. Por isso `bootstrap.sh` recebe `<email-web-qa> <email-usuario-app>` (ambos só por argumento, nunca no repo; podem ser iguais) e, se o job `indice-seed` de Produção existir, **compara** `<email-usuario-app>` com o `INDICE_USER_EMAIL` dele e aborta se divergirem. Se o job de Produção não tiver a variável, o seed de Produção usou o padrão `andre@indice.local`, e é esse que vale.
- **Senha de banco própria de QA.** O Neon copia para a branch filha os papéis com as **mesmas senhas** da mãe, e o `reset --parent` copia de novo. Sem tratamento, a URL de QA abre a Produção trocando só o host. Remédio (opção (a)): novo script `infra/cloudrun/qa-db-password.sh`, chamado pelo `qa-reset.sh` logo depois do reset e antes do `indice-migrate-qa`, e uma vez no roteiro, depois de criar a branch `qa`. Ele faz o seguinte:
  1. Troca a senha do papel usado nos secrets de QA (`neondb_owner`) **só na branch `qa`**, pela API do Neon (`POST .../branches/{qa}/roles/{papel}/reset_password`).
  2. Lê os dois secrets de QA, troca só a senha na URL, em memória, e grava uma versão nova de cada um.
  3. **Destrói** as versões anteriores, que podem conter a senha de Produção.
  4. Cria uma revisão nova de `indice-api-qa`, para as instâncias pegarem o `latest`.
  5. Confere em memória que a senha nova difere da de Produção e que o host de Produção recusa a credencial de QA, imprimindo só `ok`/`falhou`.

  A senha não passa por argumento, stdout nem arquivo. Entre o reset e a troca, QA fica sem conectar (o secret já tem a senha de QA, que a branch perdeu); nunca o contrário. `bootstrap.sh` não muda: o valor colado na primeira gravação é substituído pelo script do roteiro.
- **Reset documentado, não agendado.** `infra/cloudrun/qa-reset.sh`: reset da branch `qa` a partir da principal (Neon API; `NEON_API_KEY` só no ambiente local do Andre, nunca no repo nem no GitHub) → `indice-migrate-qa` (reaplica migrações de `development` ainda não em Produção) → `indice-seed-qa` → `indice-rekey-qa`. Rodar só quando o Andre pedir.
- **Rejeitado por ora:** mascarar dados (exige manter regra de anonimização por tabela; caro para o ganho); IAP direto no Cloud Run (dá acesso no celular, mas é mais setup e consentimento OAuth — candidato se o proxy incomodar).

## Decisões técnicas

| Decisão | Escolha | Alternativas | Por quê |
|---|---|---|---|
| Quem executa o deploy | Actions chama `gcloud builds submit` com o `cloudbuild.yaml` existente | Passos `docker build`/`gcloud run deploy` direto no Actions; gatilho nativo do Cloud Build | Uma definição de deploy só, já testada; Actions dá aprovação manual (Environments) e encadeia com o CI. Gatilho nativo duplicaria a fonte de verdade do "CI verde". |
| Autenticação GCP | WIF: pool `github`, provider `github-oidc`, condição `assertion.repository == 'AndreRenatoMenezes/indice'`; conta `gh-deployer@` com `roles/cloudbuild.builds.editor`, `roles/iam.serviceAccountUser` (na SA do build), `roles/storage.admin` no bucket de fontes do build, papel customizado `indiceBucketLister` (só `storage.buckets.list`) no projeto — o `gcloud builds submit` com o bucket padrão lista os buckets do projeto para checar que `<projeto>_cloudbuild` é dele (anti name-squatting); sem isso dá 403 —, `roles/logging.viewer` (para o `submit` acompanhar o log com `CLOUD_LOGGING_ONLY`), `roles/serviceusage.serviceUsageConsumer` | Chave JSON em secret do GitHub; `--gcs-source-staging-dir` explícito no `deploy.yml` (pula a listagem sem IAM novo) | Sem segredo de longa duração; repo público. A listagem dá só nomes e metadados de bucket, nenhum objeto; pular a checagem deixaria o build ler fonte de um bucket que, se um dia fosse apagado e recriado por outro projeto com o mesmo nome, executaria código de terceiros com a SA do build (acesso aos secrets e ao deploy). Vale para QA e Produção: mesma `gh-deployer`, mesmo bucket. |
| Escopo do token por ambiente | `attribute.environment` mapeado; ambiente `production` do GitHub restrito à branch `main`, com o Andre como revisor obrigatório | Duas contas de serviço com permissões por recurso | Um projeto só (decisão do usuário); a trava fica no GitHub Environment. |
| Acesso à web de QA | `--no-allow-unauthenticated` + `roles/run.invoker` para a conta do Andre, via `gcloud run services proxy` | IAP; senha na web; deixar pública | Dado real em QA (decisão do usuário) e web sem login; IAM é grátis e não toca `apps/web`. E-mail do Andre entra como argumento do script, não no repo. |
| Autenticação do serviço por ambiente | `cloudbuild.yaml` ganha `_WEB_AUTH` (`--allow-unauthenticated` em Produção, `--no-allow-unauthenticated` em QA) | Flag fixa | Produção mantém o comportamento atual. |
| Identificação da imagem | `_TAG = github.sha` | `$SHORT_SHA` | `$SHORT_SHA` é vazio fora de gatilho do Cloud Build; o SHA completo liga revisão ↔ commit sem ambiguidade. |
| Concorrência | `concurrency: deploy-<ambiente>`, `cancel-in-progress: false` | Cancelar o anterior | Cancelar no meio pode deixar migração aplicada sem revisão nova; enfileirar é seguro. |
| CI no deploy | `deploy.yml` faz `uses: ./.github/workflows/ci.yml` (ci ganha `on: workflow_call`) | Confiar que o PR já passou | O commit de merge pode diferir do head do PR; testa o que vai subir. |
| Gatilhos do `ci.yml` | `pull_request` (todas as bases) + `workflow_call`; remove o `push: main` | Manter | O push em `main` passa a rodar o CI dentro do deploy; evita CI duplicado. |
| Checks obrigatórios | `node` e `android` (nomes atuais dos jobs) em `development` e `main` | Só `node` | Já é o que o CI roda; Definição de Pronto exige o Android compilando. |
| Origem do `CORS_ORIGIN` da API | URL da web do mesmo ambiente, lida por `gcloud run services describe` no passo de deploy | `_WEB_ORIGIN` fixo por ambiente | Hoje é `*` por padrão; a URL `*.run.app` é estável por serviço. Se a web ainda não existe (primeiro deploy de QA), cai em `*` uma vez. |
| Repositório de imagens | Dois repositórios no Artifact Registry: `indice` (Produção, já existe) e `indice-qa` (novo). `deploy.yml` passa `_REPO=indice-qa` em QA e `_REPO=indice` em Produção | Um repositório compartilhado | Limpeza por contagem num repositório compartilhado apaga a imagem que serve Produção e as de rollback quando QA faz mais de 10 deploys entre dois de Produção. |
| Limpeza de imagens | Em cada repositório: `Delete` qualquer tag + `Keep` `mostRecentVersions.keepCount: 10`, efetiva: `cleanupPolicyDryRun` falso em cada repositório (o gcloud 585 não tem `--no-dry-run`; o bootstrap desliga o dry run por PATCH na API REST, `updateMask=cleanupPolicyDryRun`, token fora dos argumentos) | `Keep` por idade (`newerThan: 30d`); nenhuma | Por idade, Produção sem deploy por 30 dias perde a imagem em uso e todo o rollback. Separados, Produção guarda sempre os seus 10 últimos deploys. Acima de 0,5 GB o armazenamento é cobrado. |
| APK de QA | Build local com `-Pindice.apiBaseUrl=<api-qa>/ -Pindice.apiKey=<chave-qa>` (`assembleRelease`, sai *unsigned*; README manda assinar com a debug keystore via `apksigner`). Mesmo `applicationId`: instalar o de QA substitui o de Produção, documentado | Artefato do Actions; `applicationIdSuffix` de QA | Repo público expõe artefatos; o APK leva a chave. Sufixo de QA é mudança Android, fora da 002: candidata a 003 no INBOX. |

## Arquivos e fronteiras por WP (sugestão ao Maestro)

| WP | Dono sugerido | Paths | Entrega | Depende de |
|---|---|---|---|---|
| WP00 Aposentar `prev` | Git Master (Chewie) | branches | PR `prev` → `development` mergeado (CI verde); `feat/002-infra-ambientes` nasce de `development` depois disso. Apagar `prev` só com autorização explícita do Andre no momento, e só depois da WP05 | autorização do usuário para o merge |
| WP01 Pipeline parametrizado | Engineer DevOps | `infra/cloudrun/cloudbuild.yaml`, `infra/cloudrun/README.md` | `_SUFFIX`, `_TAG`, `_WEB_AUTH`, nomes de job/serviço por ambiente, CORS pela URL da web; README com: preparar ambiente do zero (QA e Produção), fluxo de branches, aprovação de Produção, acesso à web de QA pelo proxy, reset de QA, rollback (`gcloud run services update-traffic <svc> --to-revisions <rev>=100`), APK de QA (assinatura e substituição do de Produção), regra expandir/contrair de migração, `_REPO` por ambiente, texto do reset alinhado (rekey remove chaves não-QA, não rotaciona; como rotacionar) | WP00 |
| WP02 Scripts de bootstrap e reset | Engineer DevOps | `infra/cloudrun/bootstrap.sh`, `infra/cloudrun/qa-reset.sh` (novos) | `bootstrap.sh <email-web-qa> <email-usuario-app>` idempotente (`describe \|\| create`): pool/provider WIF, SA `gh-deployer` e papéis (inclui criar o papel customizado `indiceBucketLister` com `describe || create` e vinculá-lo no projeto), repositório `indice-qa` no Artifact Registry, política de limpeza nos **dois** repositórios, com `cleanupPolicyDryRun` desligado por PATCH REST se vier ligado e o valor final impresso por repositório, conferência do `<email-usuario-app>` contra o `INDICE_USER_EMAIL` do job `indice-seed` (aborta se divergir), **nomes** dos secrets de QA (valor lido de stdin, nunca argumento nem arquivo), jobs `indice-seed-qa` e `indice-rekey-qa`, `roles/run.invoker` em `indice-web-qa` para o e-mail passado como argumento. `qa-reset.sh`: reset Neon → `qa-db-password.sh` → migrate → seed → rekey; `qa-db-password.sh` (novo) conforme "Senha de banco própria de QA"; com `NEON_API_KEY` lido do ambiente | WP00 |
| WP03 Workflows | Engineer DevOps | `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` (novo) | `ci.yml` com `workflow_call`; `deploy.yml` com matriz branch→ambiente, `permissions: id-token: write, contents: read`, `google-github-actions/auth` + `setup-gcloud`, concurrency, `vars.*` para identificadores, `_REPO` por ambiente (`indice-qa` / `indice`) | WP01 (substituições) |
| WP04 Provisionar (execução externa) | Usuário (ou DevOps com autorização explícita) | nenhum arquivo | Branch Neon `qa` filha da principal; rodar `bootstrap.sh`; gravar valores dos secrets de QA; seed + rekey de QA; criar *variables* do repo (`GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`). **Provas exigidas:** (a) `gcloud artifacts repositories describe` de `indice` e `indice-qa` mostra as duas regras e `cleanupPolicyDryRun` falso/ausente, igual ao valor final que o `bootstrap.sh` imprimiu; rodar o `bootstrap.sh` de novo não altera isso; (b) `gcloud builds submit` sem `_TAG` falha antes de qualquer `docker push` (se o Cloud Build aceitar `_TAG` vazia, o `cloudbuild.yaml` ganha um primeiro passo que aborta com `_TAG` vazia, e a prova é refeita); (c) `neonctl branches reset --help` na versão instalada lista `--parent`; (d) `bootstrap.sh` com `<email-usuario-app>` diferente do da Produção aborta; (e) `gcloud projects get-iam-policy` mostra para `gh-deployer` só `cloudbuild.builds.editor`, `logging.viewer`, `serviceusage.serviceUsageConsumer` e `indiceBucketLister` no projeto (nenhum `storage.admin`/`storage.objectAdmin` em nível de projeto), e `gcloud iam roles describe indiceBucketLister` lista só `storage.buckets.list` | WP02, WP03 |
| WP05 Proteção e Environments | Git Master (Chewie) | config do GitHub | Proteção de `development` e `main`: PR obrigatório, checks `node`+`android`, sem force push, sem deleção, **"Do not allow bypassing" ligado** (vale para admin), revisão obrigatória desligada; Environments `qa` (só `development`) e `production` (só `main`, revisor obrigatório: Andre); branch padrão continua `main`. Depois, apagar `prev` se o Andre autorizar | WP03 mergeado (checks existirem); autorização do usuário |
| WP06 Aceite | Reviewer (Ahsoka) | nenhum | Roda os critérios da spec: ordem de `prev`, PR feat → development (QA sobe), 403 anônimo na web de QA e acesso pelo proxy, migração de teste em QA e não em Prod, PR development → main com deploy pendente até aprovação, 401 cruzado das chaves (também após `qa-reset.sh`), busca de segredos no repo. **Provas exigidas:** (a) primeira execução real do `qa-reset.sh` (logo após o primeiro deploy de QA, quando a cópia ainda não tem nada só de QA) termina sem erro, com `neonctl branches reset --parent` aplicado (data de reset da branch `qa` no Neon atualizada); (b) depois dele, `/habits/today` com a chave de QA devolve os dados copiados e `User` em `qa` tem a mesma contagem da Produção; (c) a imagem atual de `indice-api`/`indice-web` está no repositório `indice` e nenhuma imagem de QA foi para ele | WP04, WP05 |
| WP07 Primeira promoção | Git Master (Chewie) + usuário (aprovação) + Reviewer (Ahsoka) | nenhum arquivo | PR `development` → `main` mergeado, deploy pendente no Environment `production` aprovado pelo Andre; prova os critérios de Produção (ver "Plano de aceite") | WP06; autorização do usuário |

Ordem: WP00 → (WP01 ∥ WP02) → WP03 → WP04 → WP05 → WP06 → WP07. WP01–WP03 são um dono só (DevOps), então sem conflito de arquivo. `CLAUDE.md` ganha uma linha sobre o fluxo de branches — dono a definir pelo Maestro (sugiro o DevOps, junto da WP01).

Nada de deploy, criação de recurso pago, proteção de branch ou merge sem autorização explícita do usuário (regra da equipe).

## Plano de aceite (WP06 e WP07, 2026-10-21)

Executores: **Obi** escreve no GCP/Neon de QA; **Chewie** faz git/PR; **Ahsoka** só lê e registra evidência; **Andre** roda o que exige credencial dele ou clique dele. Nenhuma prova da WP06 escreve em Produção.

**Guarda global da WP06.** Antes do primeiro passo e depois do último, Ahsoka registra: revisão servindo de `indice-api` e `indice-web` (nome e imagem) e `SELECT count(*) FROM _prisma_migrations` na branch principal do Neon (só leitura). Os dois registros têm de ser iguais; se diferirem, a WP06 para e vira bloqueio.

**Leitura de Produção** (contagens, `_prisma_migrations`, `/habits/today` com a chave de Produção) é só leitura e mostra só números: contagem de linhas, `length` da resposta e nome de migração. Nenhum dado pessoal vai para tela, log ou nota. URLs e chaves são lidas do Secret Manager dentro do comando, sem eco.

### (a) Já tem evidência (WP04/WP05) — Ahsoka só anexa

| Critério da spec | Evidência |
|---|---|
| Chaves cruzadas (antes do reset) | 200/401 em QA, 200/401 em Produção |
| Web de QA privada (403 anônimo) | evidência da WP04 |
| Imagens em repositórios separados, política efetiva | PROVA_A e a prova de que o repositório `indice` não tem imagem de QA |
| Build sem `_TAG` falha antes de publicar | PROVA_B |
| Provas (c)–(e) da WP04 | PROVA_C–PROVA_E |
| Merge em `development` publica QA | deploy automático SUCCESS do PR #8 |
| `prev` antes do primeiro PR | WP00 (PR #6) |

### (b) WP06 — falta provar em QA, nesta ordem

| # | Prova | Executor | Escreve em | Reversível | Autorização |
|---|---|---|---|---|---|
| 1 | **Leituras de configuração.** (i) Proteção de `development` e `main` lida de volta: PR obrigatório, checks `node`+`android`, `enforce_admins`/sem bypass, sem force push nem deleção. Isso vale como prova do "botão bloqueado"; ninguém abre PR vermelho de propósito. (ii) Push recusado: a proteção de `main` é idêntica à da branch-espelho onde o push foi recusado (diff do JSON). (iii) Environment `production` com política de branch só `main` e revisor Andre; `qa` só `development`. (iv) Provider WIF com `attribute-condition` do repositório. Lido de volta, sem token de outro repositório. (v) A imagem da revisão atual de `indice-api-qa`/`indice-web-qa` tem tag = SHA do merge do PR #8. (vi) `git grep` de `postgresql://`, `private_key`, `BEGIN PRIVATE KEY` e dos hashes/prefixos das chaves no `HEAD` de `development` dá zero fora de placeholders. (vii) O README cobre os tópicos do critério. (viii) `prev`: se foi apagada, existe autorização registrada | Ahsoka | nada | — | não |
| 2 | **Falha de migração antes do deploy.** De um branch local **não publicado**, com uma migração `aceite_002_falha` contendo só `SELECT 1/0;`, Obi roda `gcloud builds submit` com as substituições de QA copiadas do `deploy.yml` (`_SUFFIX=-qa`, `_REPO=indice-qa`, secrets `indice-qa-*`, `_TAG=<sha local>`). Ahsoka confere o comando antes de rodar. Esperado: build FAILURE no passo de migração; revisões de `indice-api-qa`/`indice-web-qa` iguais às de antes; `/health` de QA 200. Limpeza: `indice-migrate-qa` executado com `--args` de `prisma migrate resolve --rolled-back <nome>`; `prisma migrate status` em QA limpo. O branch local é descartado. É o único jeito de testar sem merge, porque o CI roda `migrate deploy` e barraria a migração antes (primeira barreira, também registrada) | Obi | QA: uma imagem a mais em `indice-qa`, uma linha falha em `_prisma_migrations` de QA, removida na limpeza | sim | **sim** (escrita manual em QA fora do pipeline) |
| 3 | **Migração de teste só em QA.** PR `feat/002-aceite-migracao` → `development` com a migração `aceite_002_noop` (só `SELECT 1;`, sem mudança de schema; `schema.md` não muda). O merge dispara o deploy de QA. Esperado: deploy SUCCESS; `aceite_002_noop` em `_prisma_migrations` de QA e **ausente** na principal; tag = SHA do merge. A migração fica para sempre e será a prova da WP07 | Chewie (PR), Ahsoka (leitura) | QA (deploy); `development` (commit) | o commit sim (revert); a linha em `_prisma_migrations` não, mas é inócua | **sim** (merge) |
| 4 | **Reset real de QA.** Andre roda `infra/cloudrun/qa-reset.sh` **no próprio terminal**, porque o script lê `NEON_API_KEY` do ambiente e pede confirmação interativa, o que não funciona no shell de agente. Antes, Ahsoka confere que `NEON_BRANCH` resolve para a branch `qa`, não a principal (o script já recusa `main`/`production`; a principal não tem pai, então `reset --parent` nela falha). Esperado: script sem erro; o horário do último reset da branch `qa` no Neon (`neonctl branches get qa`) é posterior ao início do passo; `aceite_002_noop` de volta em `_prisma_migrations` de QA (prova de que as migrações de `development` foram reaplicadas); `ApiKey` em QA com uma linha só; saída do `qa-db-password.sh` com `ok` nas duas conferências (senha ≠ Produção; host de Produção recusa) | Andre (executa), Obi (apoio), Ahsoka (leitura) | QA (apaga a cópia e recopia) | QA sim (é recópia, e o Neon guarda histórico para restaurar); Produção não é escrita | **sim** (destrutivo em QA, credencial do usuário) |
| 5 | **Depois do reset.** (i) Chaves cruzadas de novo: QA 200 com a chave de QA e 401 com a de Produção; Produção 200 com a de Produção e 401 com a de QA. (ii) `/habits/today` com a chave de QA dá 200 e o mesmo `length` que `/habits/today` da Produção com a chave de Produção, no mesmo dia. (iii) `count(*)` de `User` em QA igual ao da Produção; o mesmo para `Habit`. Os números só batem se o seed não criou usuário novo. (iv) Ahsoka refaz, independente do script, a comparação em memória da senha de QA com a de Produção, sem imprimir, e confere que os dois secrets de QA têm uma única versão. (v) Pelo `gcloud run services proxy indice-web-qa`, Andre confirma que a página carrega com dados, sem captura de tela no repositório | Ahsoka (i–iii), Andre (iv) | nada | — | não |

### (c) WP07 — primeira promoção `development` → `main`

A WP07 fecha os critérios de Produção:
- o deploy de `main` fica pendente até a aprovação do Andre e, sem aprovação, nada muda;
- a migração mergeada aparece na Produção só depois do merge em `main`, provada com `aceite_002_noop`;
- depois do deploy, a revisão de Produção usa a tag = SHA do merge e as chaves cruzadas na Produção continuam dando 200/401.

Não cabe na WP06 porque a promoção publica em Produção tudo o que está em `development` desde `de4c007`: a 001 (lista semanal) inteira, a 002 e a `aceite_002_noop`. Isso é um release de produto, com autorização própria do usuário.

**Pode ficar como primeira promoção real**, e deve vir logo depois da WP06. Riscos de adiar:
- `main` não tem os workflows da 002, então um `hotfix/*` aberto de `main` hoje não faz deploy automático. Até a WP07, hotfix volta ao deploy manual documentado.
- O caminho de deploy de Produção pelo Actions só fica provado nesse momento.

Sobre `main` não ter os workflows: no `push` do merge, o GitHub usa os workflows do commit mergeado, então o `deploy.yml` roda já na promoção.

Passos da WP07, nesta ordem:
1. Ahsoka lista o delta de migrações entre `main` e `development`. Hoje só a `aceite_002_noop`; se houver outra, confere se é só de expandir.
2. Obi cria uma branch Neon de segurança da principal (`pre-promocao-<data>`), só leitura da principal. Ela é apagada só com OK do Andre depois de 7 dias de Produção estável.
3. Chewie abre o PR `development` → `main` com CI verde e faz o merge com autorização.
4. Ahsoka registra que o deploy está pendente e que a revisão de Produção não mudou durante a espera.
5. Andre aprova no Environment `production`.
6. Ahsoka verifica: deploy SUCCESS, tag = SHA, `aceite_002_noop` na principal, chaves cruzadas 200/401 em Produção, `/health` 200.

Volta atrás: `gcloud run services update-traffic` para a revisão anterior; dados pela branch de segurança. Executor da aprovação: Andre. Escrita: Produção. Reversível: revisão sim; a migração é inócua. Autorização: **sim**, para o merge e para a aprovação.

## Riscos

- **Primeiro deploy automático em Produção** troca o caminho manual pelo do Actions sobre o mesmo `cloudbuild.yaml`: validar em QA antes de ligar o gatilho de `main`.
- **Neon free:** branches compartilham a cota de compute do projeto; QA com autosuspend gasta só quando usado.
- **Dados reais em QA** (decisão do usuário): a API de QA é pública com a chave de QA, que mora no APK de QA no celular do Andre. Vazou o APK, vazou acesso à cópia — mesmo risco que já existe com a chave de Produção.
- **Web de Produção sem login** continua (INBOX).
- **APK de QA substitui o de Produção** no aparelho (mesmo `applicationId`); trocar de ambiente no celular é reinstalar. Assinatura diferente entre os dois APKs exige desinstalar antes.
- **Rekey esquecido** após um reset manual pelo painel do Neon reabre QA para a chave de Produção: o README manda resetar só pelo `qa-reset.sh`.
- **Reset pelo painel do Neon também restaura a senha de Produção na branch `qa`**, mas o secret de QA continua com a senha de QA, então QA para de conectar e não vaza nada. O conserto é rodar `qa-db-password.sh` (ou o `qa-reset.sh` inteiro).
- **Senha de Produção já esteve nos secrets de QA** (de WP04 até a emenda). O acesso a esses secrets é das mesmas contas que já leem os de Produção (dono do projeto e SA de runtime compartilhada; `gh-deployer` não lê secrets), então a exposição não se ampliou. Rotacionar a senha de Produção só se essa URL tiver aparecido fora do Secret Manager (log, terminal, nota). A decisão é do usuário.

## Decisões do usuário (2026-10-20)

1. Um projeto GCP, sufixo `-qa`. 2. Aprovação manual em Produção, Andre revisor do Environment `production`. 3. QA sempre implantado, escala a zero. 4. `main` sem push direto para ninguém, sem bypass de admin. 5. `prev` aposentada: PR `prev` → `development`; apagar só com autorização explícita no momento. 6. QA com cópia dos dados reais (branch Neon filha da Produção), contra a recomendação da Arquiteta; mitigação acima (web de QA por IAM, rekey, reset por script).
