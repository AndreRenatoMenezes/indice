# Decisões

Decisões reversíveis tomadas sem consultar o usuário. Só acréscimo.

Entrada: data · autor · decisão · racional · alternativas rejeitadas · custo de reverter · escopo afetado.

## 2026-10-20 · Luke (Maestro)

- **Decisão:** time inicial é Leia (Arquiteto), Chewie (Git Master), Rex (Engineer), Ahsoka (Reviewer), já presentes no canvas. Rex possui `apps/web/**`, `apps/api/**` e `packages/**` provisoriamente. Ahsoka valida usando os portais "Portal" (web) e "Pixel 10".
- **Racional:** aproveitar o time existente em vez de recrutar duplicatas. Web/API e Android têm paths disjuntos, então um segundo Engineer pode rodar em paralelo depois.
- **Alternativas rejeitadas:** recrutar Engineer Android e DevOps já; sem spec, não há o que atribuir.
- **Custo de reverter:** baixo (só reatribuição de paths).
- **Escopo afetado:** `equipe.md`.

## 2026-10-20 · Luke (Maestro)

- **Decisão:** antes de nova feature de produto, abrir `002-infra-ambientes` (git flow com QA e Produção, deploy automático por branch). Descoberta com a Leia; nenhum executor começa antes da spec.
- **Racional:** pedido do usuário. Hospedagem/CI-CD tem custo alto de reverter e toca segredos, então o desenho é do Arquiteto e do usuário.
- **Proposta inicial (para a Leia contestar, não é contrato):** `feat/*` → PR em `development` (deploy QA) → PR em `main` (deploy Produção); branch Neon por ambiente; Workload Identity Federation no GitHub Actions; migração via job antes da nova revisão.
- **Custo de reverter:** não se aplica ainda (nada executado).
- **Escopo afetado:** roadmap; futuras WPs de `.github/workflows/**` e `infra/**`.

## 2026-10-20 · Leia (Arquiteto)

- **Decisão:** deploy de 002 reaproveita `infra/cloudrun/cloudbuild.yaml` (GitHub Actions autentica por WIF e chama `gcloud builds submit`), com ambiente por sufixo (`_SUFFIX` = `""`/`-qa`) e tag `_TAG` = SHA do commit no lugar de `$SHORT_SHA`.
- **Racional:** uma definição de deploy só, já testada em Produção; `$SHORT_SHA` é vazio fora de gatilho do Cloud Build.
- **Alternativas rejeitadas:** passos `docker`/`gcloud run deploy` direto no Actions (duplica o pipeline); gatilho nativo do Cloud Build (duplica a fonte do "CI verde").
- **Custo de reverter:** baixo (troca de passos no workflow).
- **Escopo afetado:** `infra/cloudrun/**`, `.github/workflows/**`.

## 2026-10-20 · Leia (Arquiteto)

- **Decisão:** APK de QA não é publicado pelo CI; gera-se localmente com `-Pindice.apiBaseUrl`/`-Pindice.apiKey`. Deploy enfileira por ambiente (`cancel-in-progress: false`) e roda o CI sobre o commit mergeado (`ci.yml` vira `workflow_call`).
- **Racional:** repo é público e o APK carrega a chave de API; cancelar deploy no meio pode deixar migração sem revisão nova.
- **Alternativas rejeitadas:** artefato do Actions; Firebase App Distribution (provedor novo, fica para depois).
- **Custo de reverter:** baixo.
- **Escopo afetado:** `.github/workflows/**`, `infra/cloudrun/README.md`.

## 2026-10-20 · Leia (Arquiteto)

- **Decisão:** 002 não muda o schema nem `schema.md`. Perguntas 5 (`prev`) e 6 (dados de QA) acrescentadas às 4 do Maestro: são caras (fluxo de branch, dado pessoal) e vão ao usuário.
- **Racional:** `prev` está 22 commits à frente de `main` e sem papel; web sem login torna cópia de dados de Produção em QA uma segunda exposição.
- **Custo de reverter:** n/a (perguntas).
- **Escopo afetado:** `002-infra-ambientes/plan.md`.

## 2026-10-20 · Leia (Arquiteto)

- **Decisão:** mitigação da cópia de dados reais em QA (escolha do usuário, pergunta 6): `indice-web-qa` sem acesso anônimo (IAM, `roles/run.invoker` só para o Andre, acesso por `gcloud run services proxy`); job `indice-rekey-qa` remove de `qa` toda `ApiKey` que não seja a de QA (a cópia traz a de Produção e o seed só faz upsert); reset de QA só por `infra/cloudrun/qa-reset.sh` (reset Neon → migrate → seed → rekey), sob demanda, com `NEON_API_KEY` local.
- **Racional:** web não tem login; sem isso a cópia da Produção ficaria numa segunda URL pública e a chave de Produção abriria QA. Nenhuma mudança em código de app.
- **Alternativas rejeitadas:** mascaramento de dados (regra por tabela a manter); IAP no Cloud Run (acesso no celular, mas mais setup — candidato se o proxy incomodar).
- **Custo de reverter:** baixo (flags de deploy e um job).
- **Escopo afetado:** `infra/cloudrun/**`, WP00–WP06 de `002-infra-ambientes`.

## 2026-10-20 · Luke (Maestro)

- **Decisão:** reescrevi os roles de Leia, Chewie, Rex e Ahsoka para o Índice e criei `Engineer-DevOps`. Backup dos antigos no scratchpad da sessão.
- **Racional:** os roles antigos eram de outro projeto (bot Telegram, Supabase, fluxo com `prev`) e contradiziam `CLAUDE.md` e a feature 002.
- **Alternativas rejeitadas:** manter os roles e corrigir no briefing (viola "handoff por arquivo" e repete custo a cada mensagem).
- **Custo de reverter:** baixo; os agentes reiniciam a sessão.
- **Escopo afetado:** todos os agentes do canvas.

## 2026-10-20 · Luke (Maestro)

- **Decisão:** partição da 002 em WP00 a WP06 conforme `current/002-infra-ambientes/tasks.md`. WP01 a WP03 têm um dono (DevOps) em paths disjuntos; `CLAUDE.md` vai para a WP01.
- **Racional:** sugestão de fronteiras da Leia no `plan.md`.
- **Custo de reverter:** baixo.

## 2026-10-20 · Leia (Arquiteto)

- **Decisão:** emenda da 002 após os riscos levantados pelo Obi na entrega de WP01–WP03. (1) Imagens de QA vão para um repositório próprio do Artifact Registry (`indice-qa`), Produção fica em `indice`; cada um mantém as 10 versões mais recentes, com a política aplicada de fato (`--no-dry-run`). (2) O `bootstrap.sh <email-web-qa> <email-usuario-app>` do Obi é aceito; ganha conferência do e-mail do app contra o `INDICE_USER_EMAIL` do job `indice-seed` de Produção, abortando se divergir. (4) Texto da spec alinhado ao rekey implementado: o reset remove chaves não-QA e não rotaciona a de QA; rotação documentada à parte. (5) Provas de `neonctl branches reset --parent`, política de limpeza efetiva e `_TAG` ausente viram critérios da WP04/WP06; se o Cloud Build aceitar `_TAG` vazia, o `cloudbuild.yaml` ganha passo de guarda.
- **Racional:** com repositório compartilhado e limpeza por contagem, mais de 10 deploys de QA entre dois de Produção apagariam a imagem em uso e o rollback; manter por idade (`newerThan: 30d`) apaga tudo de Produção após 30 dias sem deploy. Seed com e-mail diferente cria usuário vazio e QA deixa de ser cópia útil.
- **Alternativas rejeitadas:** `Keep newerThan 30d`; aumentar `keepCount` (só adia o problema); derivar o e-mail só do job de Produção sem argumento (o job pode não ter a variável).
- **Custo de reverter:** baixo (um repositório, uma substituição, uma checagem em script).
- **Escopo afetado:** `002-infra-ambientes/spec.md`, `plan.md`; WP01 (README), WP02 (`bootstrap.sh`), WP03 (`deploy.yml`), WP04, WP06.

## 2026-10-20 · Luke (Maestro)

- **Decisão:** APK de QA e Produção com o mesmo `applicationId` (opção A da Leia): aceitar e documentar na 002; feature Android `003` (applicationIdSuffix `.qa`) fica no INBOX. WP01–WP03 voltam a `fazendo` para a emenda da Leia (repositório `indice-qa`, `_REPO`, checagem de e-mail no bootstrap, texto do rekey).
- **Racional:** recomendação da Arquiteta, não bloqueia a 002, custo de reverter baixo; o usuário pode pedir a 003 quando quiser.
- **Escopo afetado:** `infra/cloudrun/**`, `.github/workflows/deploy.yml`, INBOX.

## 2026-10-20 · Leia (Arquiteto)

- **Decisão:** aprovado o desvio de forma do Obi na WP02. O gcloud 585.0.0 não tem `set-cleanup-policies --no-dry-run` (só `--dry-run`), então o `bootstrap.sh` aplica a política sem a flag, lê `cleanupPolicyDryRun` e, se vier `True`, desliga por PATCH na API REST do Artifact Registry (`updateMask=cleanupPolicyDryRun`, token fora dos argumentos), imprimindo o valor final por repositório. O contrato passa a exigir o resultado (`cleanupPolicyDryRun` falso), não a flag.
- **Racional:** o intento (política efetiva) se mantém; a prova (a) da WP04 já verifica o estado no `describe`, independentemente do caminho.
- **Alternativas rejeitadas:** atualizar o gcloud à espera da flag (não garantida); deixar em dry run (a limpeza não apagaria nada).
- **Custo de reverter:** baixo.
- **Escopo afetado:** `002-infra-ambientes/plan.md` (decisão de limpeza, WP02, prova (a) da WP04); substitui o "`--no-dry-run`" da decisão anterior.

## 2026-10-21 · Luke (Maestro)

- **Decisão:** a WP04 passa a ser executada pelo Obi (passos 1 a 10 do `wp04-roteiro.md`), por pedido e autorização explícita do usuário. O usuário faz os logins (gcloud, neon, gh) e digita segredos e a frase de confirmação do passo 8; o Obi nunca lê nem grava esses valores. Passo 11 em diante (merge do PR #7, primeiro deploy de QA) exige nova autorização. Exceção ao "git/GitHub só do Chewie": `gh variable list/set` das 3 variables do passo 10, só pelo Obi.
- **Racional:** o roteiro tem gates binários e foi aprovado em 3 revisões independentes; o risco sobre Produção (passo 8) continua com gate humano.
- **Alternativas rejeitadas:** Obi executa também o merge; passo 10 pelo Chewie (Copilot trava em permissões).
- **Custo de reverter:** médio — recursos de QA têm desfazer guiado por inventário; imagens apagadas do repositório `indice` não têm rollback (passo 8).
- **Escopo afetado:** role `Engineer-DevOps` (exceção registrada), WP04.

## 2026-10-21 · Luke (Maestro)

- **Decisão:** GATE_P7 falhou na fase A (Keychain apagado, nada alterado no GCP). Autorizada nova tentativa com: (1) diagnóstico read-only `neonctl cs … | wc -l` (só contagem); (2) gate imprimindo ok/falhou por condição em `07-gate-diagnostico.txt`, sem valores; (3) comandos do usuário com `head -1 | tr -d '\n'` no lugar de `awk printf`. Condições do gate não afrouxam.
- **Racional:** hipótese mais provável é saída multilinha concatenada; diagnóstico sem expor segredo.
- **Alternativas rejeitadas:** relaxar o gate; imprimir as URLs.
- **Custo de reverter:** baixo (só roteiro/comandos). Ahsoka revisa o diff do gate depois.
- **Escopo afetado:** `wp04-roteiro.md` passo 7.

## 2026-10-21 · Luke (Maestro)

- **Decisão:** 2ª falha do GATE_P7 (13/15 ok; faltou o sufixo `pgbouncer`/`connection_limit`). Causa provável: prompt sem eco do `security -w` corta em 128 caracteres. Passo 7 muda: o Obi grava as URLs no Keychain por pipe `neonctl cs | security -i` (stdout/stderr descartados, sem clipboard, argv ou arquivo); o usuário deixa de digitar as URLs. Gate soma igualdade em memória Keychain == saída fresca do `neonctl`. A frase do passo 8 continua do usuário. Ahsoka revisa o diff antes da gravação.
- **Racional:** valor nunca é impresso nem digitado; elimina o corte e o erro de colagem; os valores já vêm do Neon autenticado pelo usuário.
- **Alternativas rejeitadas:** manter colagem do usuário (corte silencioso); só apertar o gate (continuaria falhando).
- **Custo de reverter:** baixo (roteiro).
- **Escopo afetado:** `wp04-roteiro.md` passo 7, role `Engineer-DevOps` (regra "usuário digita segredos" restrita à frase do passo 8).

## 2026-10-21 · Leia (Arquiteto)

- **Decisão:** opção A para o 403 do primeiro deploy de QA. `gh-deployer` recebe o papel customizado `indiceBucketLister` (só `storage.buckets.list`) no projeto; `bootstrap.sh` cria o papel e o vínculo de forma idempotente; o roteiro e o "Desfazer" do README ganham as linhas correspondentes. `deploy.yml` não muda.
- **Racional:** o `gcloud builds submit` com o bucket padrão lista os buckets do projeto para confirmar que `<projeto>_cloudbuild` pertence a ele. A permissão nova expõe só nomes e metadados de bucket, nenhum objeto. A opção B (`--gcs-source-staging-dir`) pula essa checagem: se o bucket um dia fosse apagado e o nome tomado por outro projeto, o build leria a fonte de lá e executaria código de terceiros com a SA do build, que lê os secrets e faz deploy em Produção.
- **Efeito em Produção:** o deploy de `main` usa a mesma `gh-deployer` e o mesmo bucket, então tinha o mesmo 403 latente; a correção vale para os dois ambientes. Nenhum serviço ou secret de Produção muda.
- **Alternativas rejeitadas:** opção B; `roles/storage.admin` ou um papel predefinido de leitura de bucket no projeto (mais permissões que o necessário).
- **Custo de reverter:** baixo. Papel customizado apagado fica reservado por cerca de 37 dias (`gcloud iam roles undelete` para recriar com o mesmo ID).
- **Escopo afetado:** `002-infra-ambientes/plan.md` (autenticação GCP, WP02, prova (e) da WP04); `infra/cloudrun/bootstrap.sh`, `infra/cloudrun/README.md`.

## 2026-10-21 · Leia (Arquiteto)

- **Decisão:** aceite da 002 dividido em WP06 (tudo provável em QA e por leitura, sem escrita em Produção) e WP07 (primeira promoção real `development` → `main`, com aprovação no Environment `production`). Plano por critério em `plan.md` ("Plano de aceite"). Provas por leitura de configuração valem para "botão bloqueado" (proteção com checks obrigatórios), "push recusado em `main`" (proteção idêntica à da branch-espelho testada) e "WIF recusa outro repositório" (condição do provider). O critério "11 deploys de QA seguidos" vira prova estrutural (QA publica só em `indice-qa`; `indice` sem imagem de QA). Falha de migração é provada por `gcloud builds submit` manual em QA a partir de branch local não publicado, com limpeza por `prisma migrate resolve --rolled-back`. A migração de QA é provada por uma migração inócua `aceite_002_noop` (`SELECT 1;`, sem mudança de schema, `schema.md` intocado), que fica no histórico e serve de prova da WP07. O `qa-reset.sh` é executado pelo Andre no próprio terminal (credencial Neon e confirmação interativa).
- **Racional:** nenhuma prova da WP06 precisa escrever em Produção; a promoção publica a 001 inteira e é decisão de release do usuário. Abrir PR vermelho, empurrar em `main` ou forjar token de outro repositório testariam o GitHub/GCP, não o contrato, e o push em `main`, se a regra estivesse errada, entraria em Produção.
- **Alternativas rejeitadas:** migração com erro mergeada em `development` (quebraria o pipeline de QA e seria promovida); fazer 11 deploys de QA; deixar a promoção sem WP própria.
- **Custo de reverter:** baixo; a `aceite_002_noop` é permanente, mas inócua.
- **Escopo afetado:** `002-infra-ambientes/plan.md` (Plano de aceite, WP07), `spec.md` (dois critérios reescritos com a forma da prova).

## 2026-10-21 · Luke (Maestro)

- **Decisão:** erro de orquestração. Instruí o Chewie a fazer `git stash -u` incluindo `.maestri/`; isso removeu as pastas dos roles e quebrou o diretório de trabalho de todos os terminais. Por pedido explícito do usuário ("corrija"), executei eu mesmo, uma única vez, `git stash pop` depois de ler o estado (árvore limpa, stash intacto, sem conflito). Exceção pontual à regra "git só do Git Master": nenhum executor tinha shell funcional. Daqui em diante `.maestri/` nunca entra em stash (stash só de arquivos rastreados, sem `-u`).
- **Racional:** restaurar o estado local do usuário, ação não destrutiva e reversível.
- **Alternativas rejeitadas:** pedir ao usuário para digitar o comando (já oferecido; o usuário pediu a correção direta).
- **Custo de reverter:** baixo (o stash foi consumido; os arquivos voltaram idênticos).
- **Escopo afetado:** WP06 passo 3 (reinício do Chewie).
