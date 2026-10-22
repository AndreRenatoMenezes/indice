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

## 2026-10-21 · Leia (Arquiteto)

- **Decisão:** opção (a) para a herança de senha do Neon. A senha do papel de QA (`neondb_owner`) é trocada só na branch `qa` por um novo `infra/cloudrun/qa-db-password.sh`. O `qa-reset.sh` o chama logo depois de cada `reset --parent`, e o roteiro o chama uma vez, depois de criar a branch. O script regrava os dois secrets de QA com a senha nova, destrói as versões antigas, força revisão nova de `indice-api-qa` e confere em memória que a senha nova difere da de Produção e que o host de Produção a recusa. Critério novo na spec. O `qa-reset.sh` real da WP06 espera a emenda.
- **Racional:** o Neon copia papéis e senhas para a branch filha e de novo a cada reset, então qualquer remédio aplicado uma vez só se perde. Com o passo dentro do `qa-reset.sh`, o secret de QA nunca volta a ter a senha de Produção: no pior caso (reset pelo painel), QA fica sem conectar.
- **Alternativas rejeitadas:** (b) papel próprio de QA. Também some a cada reset e ainda exige conceder posse ou DDL das tabelas de `neondb_owner` para o `prisma migrate`. (c) Dados mascarados ou só o schema mais o seed. Contraria a decisão 6 do usuário (QA com cópia real) e só mudaria com nova pergunta a ele.
- **Custo de reverter:** baixo (um script e uma chamada). As versões antigas dos secrets destruídas não voltam, mas só guardavam uma cópia da credencial de Produção.
- **Escopo afetado:** `002-infra-ambientes/spec.md` (garantia e critério novos), `plan.md` (mitigação, WP02, passos 4 e 5 do aceite, riscos); `infra/cloudrun/qa-reset.sh`, `qa-db-password.sh` (novo), `README.md` (roteiro).

## 2026-10-22 · Luke (Maestro)

- **Decisão:** INCIDENTE. `docs/deploy-manual.md` (linhas 150 e 153, commit 0a41786, 2026-09-20) traz connection strings com a senha ATUAL do banco de Produção, em repositório público. A Ahsoka confirmou por comparação em memória: senha igual à de Produção, a credencial conecta hoje (SELECT 1 ok); não é igual à de QA (já rotacionada). O usuário autorizou só PREPARAR o roteiro de rotação da senha de Produção; a execução exige nova autorização explícita. Enquanto não rotacionar, o risco fica aceito e registrado. O histórico não será reescrito (force push proibido); o remédio é a rotação.
- **Racional:** apagar a linha do arquivo não remove o valor do histórico público.
- **Alternativas rejeitadas:** reescrever histórico (force push); rotacionar sem roteiro revisado.
- **Custo de reverter:** não se aplica (nada executado).
- **Escopo afetado:** Produção (secrets e revisão da API), `docs/deploy-manual.md`, critério 14 da spec (WP06 não fecha até a rotação).

## 2026-10-22 · Luke (Maestro)

- **Decisão:** incidente da credencial em `docs/deploy-manual.md` FECHADO no lado de Produção. Rotação da senha de Produção executada pelo usuário (`prod-db-password.sh` terminou em ok), com a verificação independente da Ahsoka aprovada (`ROTACAO=ok`): senha vazada recusada (P1000), senha nova conecta pelo pooler e pela direta, secrets com uma versão ativa e a antiga destruída, API `indice-api-00004-54v` com `/health` 200, chaves cruzadas 200/401/200/401, ledger de Produção intacto, QA e Produção sem acesso cruzado (teste discriminante: host trocado não alcança o compute oposto). O valor antigo continua no histórico público do git (commit 0a41786), agora inválido. O texto do arquivo é corrigido por PR (placeholders + aviso neutro); o critério 14 só fecha com o merge desse PR em `development`, a cargo do usuário.
- **Racional:** histórico não é reescrito (force push proibido); a rotação neutraliza a credencial.
- **Alternativas rejeitadas:** reescrever histórico; deixar a senha como estava.
- **Custo de reverter:** não se aplica.
- **Escopo afetado:** Produção (secrets e revisão da API), `docs/deploy-manual.md`, `infra/cloudrun/prod-db-password.sh`.

## 2026-10-22 · Luke (Maestro)

- **Decisão:** o usuário autorizou explicitamente a promoção `development` → `main` (WP07, primeira promoção real, deploy de Produção) para depois que a Ahsoka concluir o aceite final da WP06 sem reprovados, e pediu a lista de branches a apagar. A aprovação do deploy de Produção continua sendo do usuário no Environment `production`. O usuário apaga as branches; ninguém apaga branch sem OK dele no momento. Pré-condições minhas: ACEITE_FINAL sem reprovados; delta de migrações expand-only (só `aceite_002_noop`); branch Neon de segurança `pre-promocao-<data>` criada a partir da principal antes do merge (precaução da Leia, no plano de aceite).
- **Racional:** pedido do usuário; a promoção publica a 001 inteira mais a 002 em Produção, então só começa com o aceite fechado.
- **Alternativas rejeitadas:** promover antes do aceite final; apagar branches por conta própria.
- **Custo de reverter:** médio (`update-traffic` para a revisão anterior; dados pela branch de segurança; migração é inócua).
- **Escopo afetado:** `main`, Produção, WP07.

## 2026-10-22 · Luke (Maestro)

- **Decisão:** spec 002-infra-ambientes encerrada do lado dos agentes. WP00–WP07 em `tasks-done.md`. A primeira promoção `development` → `main` (PR #12) foi feita com autorização do usuário, que aprovou o deploy no Environment `production`; a Ahsoka verificou de forma independente a Produção depois (`WP07=ok`). A interface do GitHub mostrou o job `deploy` como "queued" por cerca de 15 minutos, enquanto o Cloud Run já estava nas revisões novas; a prova veio do GCP e o job fechou como `completed/success`. Fica como melhoria (INBOX da Leia): fonte local no web (`next/font/local`), porque o build depende do Google Fonts e falhou uma vez por erro transitório.
- **Pendências do usuário:** critério 9 (web de QA pelo proxy), revogar a `NEON_API_KEY` e apagar o item do Keychain, apagar as branches mergeadas, apagar a branch Neon `pre-promocao-20261022` após 7 dias estável.
- **Custo de reverter:** `update-traffic` para `indice-api-00004-54v` e `indice-web-00003-c65`; dados pela branch Neon de segurança.
- **Escopo afetado:** 002-infra-ambientes.

## 2026-10-22 · Luke (Maestro)

- **Decisão:** feature 003-login-multiusuario aberta. Descoberta delegada à Leia (Arquiteta); Chewie prepara a branch `feat/003-login-multiusuario` localmente. Nenhum executor de código começa antes da `spec.md`. Escolha do provedor (Better Auth no Fastify x Neon Auth gerenciado) é do usuário, na descoberta com a Leia. Minha recomendação, após a pesquisa dela: Better Auth no Fastify (Neon Auth beta exige Next 16, branch Neon em dev/CI, `qa-reset` copiaria usuários de Produção, Android sem suporte documentado).
- **Racional:** escolha de provedor tem impacto de segurança e dado pessoal, então não é decisão do Maestro.
- **Alternativas rejeitadas:** decidir o provedor por conta própria; começar implementação antes do contrato.
- **Custo de reverter:** baixo agora (só branch local).
- **Escopo afetado:** 003-login-multiusuario.

## 2026-10-22 · Leia (Arquiteto)

- **Decisão:** na 003, a API é a fachada de auth (`POST /auth/*`). Web e Android nunca falam com o Neon Auth. A API devolve o JWT do Neon (15 min) como `accessToken` e o token de sessão opaco como `refreshToken`, e as rotas de dados verificam o JWT localmente pelo JWKS, com `issuer`/`audience` obrigatórios. Não usamos o SDK `@neondatabase/auth` (beta, peer `next >=16`), e a web segue no Next 15 com cookies `httpOnly` próprios, renovados no `middleware.ts`.
- **Racional:** o protocolo com o Neon Auth fica num lugar só e testável, o Android mantém uma base URL e um contrato, e não há upgrade de framework. O Managed não expõe o plugin `bearer`, então um cliente nativo direto exigiria tratar cookie e `Origin` em Kotlin.
- **Alternativas rejeitadas:** SDK Neon na web com Next 16 (upgrade grande e SDK beta); clientes falando direto com o Neon Auth (protocolo duplicado em TS e Kotlin).
- **Custo de reverter:** médio. Os clientes só conhecem `/auth/*` da API; trocar o provedor depois mexe só na API.
- **Escopo afetado:** 003 (API, web, Android).

## 2026-10-22 · Leia (Arquiteto)

- **Decisão:** detalhes da 003 decididos sem pergunta: (1) ligação do usuário atual por e-mail verificado no primeiro login, sem migração de dados por SQL; (2) usuário novo nasce vazio (só `UserSettings`); (3) `sign-up` com e-mail fora da lista responde 403 (revela se o e-mail está na lista, aceito em app pessoal); (4) SMTP compartilhado do Neon; (5) web de QA continua fechada por IAM, com `AUTH_WEB_ORIGIN` de QA = origem do proxy `http://127.0.0.1:3100`; (6) usuários e hashes de senha da Produção herdados por QA no reset, coerente com a decisão 6 da 002; (7) Android com `allowBackup="false"`; (8) a allowlist fica em secret por ambiente, porque e-mail é dado pessoal e o repositório é público.
- **Racional:** menor superfície que atende ao aceite; nenhuma delas muda regra de negócio além do que o usuário escolheu.
- **Alternativas rejeitadas:** ligação manual por script; categorias iniciais para usuário novo; SMTP próprio já na v1; allowlist em env aberta no `cloudbuild.yaml`.
- **Custo de reverter:** baixo para cada item.
- **Escopo afetado:** 003.

## 2026-10-22 · Luke (Maestro)

- **Decisão:** contrato da 003 conferido (aceite binário, fronteiras explícitas, contratos nomeados). Partição: WP02, WP03 e WP04 com Rex (um dono para `packages/**` e `apps/api|web`), WP05 Engineer Android novo, WP01 e WP06 com Obi, WP07 com Ahsoka. `schema.md` é editado pelo Rex, aplicando o texto do delta do `plan.md` no mesmo commit da migração. Preset do Engineer Android: Claude Code, confirmado pelo usuário. Usuário autorizou habilitar o Neon Auth na branch principal e na `dev` (WP01).
- **Racional:** a Leia deixou a escolha do dono do `schema.md` para o Maestro; Rex no commit evita dois editores na migração e custa menos que um handoff extra.
- **Alternativas rejeitadas:** Leia editar o `schema.md` junto (dois donos no mesmo commit); dois Engineers no web/API.
- **Custo de reverter:** baixo (só quem edita o arquivo).
- **Escopo afetado:** 003, WP02 e WP05.

## 2026-10-22 · Luke (Maestro)

- **Decisão:** a Ahsoka (Gemini 3.8 Flash) bateu a cota individual (volta em ~145h). Troca de agente no lugar para Claude Code, confirmada pelo usuário; Rex passou a rodar `agy --mode accept-edits` (confirmado pelo usuário) para reduzir prompts de permissão. Cassian relatou duas decisões fora do plan: sign-in com e-mail não verificado reenvia o código e abre a tela Código; "Sair" só na aba Hoje.
- **Racional:** manter revisão independente de quem produz (regra 5); as duas decisões do Cassian são de comportamento de produto e vão à Leia se a Ahsoka as reprovar.
- **Custo de reverter:** baixo (troca de agente é no lugar).
- **Escopo afetado:** WP02, WP05, revisões.

## 2026-10-22 · Leia (Arquiteto)

- **Decisão:** duas propostas do Cassian (WP05) foram aceitas e formalizadas no `plan.md` da 003. (1) Sign-in com 403 `email not verified` reenvia o código automaticamente (`/auth/resend-verification`) e abre a tela Código, no Android e na web. (2) No Android, o "Sair" fica só na aba Hoje, e a tela "acesso removido" tem o seu próprio "Sair".
- **Racional:** (1) poupa um toque, e o reenvio já é idempotente (204 sempre); (2) sem a ressalva, um usuário tirado da lista ficaria sem saída.
- **Custo de reverter:** baixo.
- **Escopo afetado:** 003 (WP04 e WP05).

## 2026-10-22 · Luke (Maestro)

- **Decisão:** WP03 (código e lógica pura) aprovada pela Ahsoka; parte de protocolo do Neon Auth fica pendente do spike da WP01 (4 pontos listados no relatório dela). WP03 só fecha "pronta" com a prova ponta a ponta. WP04 (web) começa em paralelo contra o contrato fixo. Ressalva de segurança da Ahsoka: `trustProxy: true` faz o limite de 10/min por IP em `/auth/*` ser contornável forjando `X-Forwarded-For`; Rex corrige para o número de saltos do Cloud Run, com evidência, ou registra o risco aceito.
- **Racional:** ressalva de baixo custo, no arquivo da WP03 do Rex; sem mudança de contrato.
- **Custo de reverter:** baixo.
- **Escopo afetado:** WP03.

## 2026-10-22 · Leia (Arquiteto)

- **Decisão:** na web da 003, o cookie `indice_rt` passa a ter `maxAge` de 7 dias e é regravado com mais 7 dias a cada refresh bem-sucedido (janela deslizante). Fechar o navegador não desloga.
- **Racional:** mesmo comportamento do Android. Os 7 dias seguem a validade padrão da sessão do Better Auth, e quem manda é a sessão do Neon: vencida ou revogada, o refresh dá 401 e leva a `/entrar`. O "Sair" revoga a sessão no servidor.
- **Alternativas rejeitadas:** cookie de sessão (desloga a cada vez que fecha o navegador, o que incomoda num app pessoal de uso diário); 30 dias (passaria da sessão do Neon e só guardaria um token morto).
- **Custo de reverter:** baixo (um atributo do cookie).
- **Escopo afetado:** 003, WP04.
