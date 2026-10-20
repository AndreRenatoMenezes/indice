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
