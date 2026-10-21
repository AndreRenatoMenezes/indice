---
feature: 002-infra-ambientes
dominio: infra
tags: [git-flow, neon-branch, ci-cd, cloud-run, neon, github-actions, workload-identity, qa, producao]
status: pronto   # esclarecendo | pronto
criada_em: 2026-10-20
---

# Ambientes QA e Produção com deploy automático por branch

## Em uma frase

Mergeio um PR em `development` e o QA se atualiza sozinho; mergeio `development` em `main` e a Produção se atualiza (com meu OK, se eu quiser), sem rodar `gcloud` à mão.

## O que muda na prática

- **Hoje:** existe um ambiente só (Cloud Run `indice-api`/`indice-web` no projeto `indice-509203`, banco Neon). Deploy é manual (`gcloud builds submit` com `infra/cloudrun/cloudbuild.yaml`). O CI (`.github/workflows/ci.yml`) roda em PR, mas nada impede merge com CI vermelho. Três branches longas (`main`, `development`, `prev`) sem papel definido; `prev` está 22 commits à frente de `main`.
- **Depois:** dois ambientes — **QA** e **Produção** — no mesmo projeto GCP (`indice-509203`; QA com sufixo `-qa`), cada um com API, web, banco (branch Neon própria), chave de API e segredos próprios. QA fica sempre implantado e escala a zero.
- **Dados de QA são uma cópia da Produção** (branch Neon `qa` filha da principal), por escolha do usuário. Por isso a web de QA **não é pública**: só abre para a conta Google do Andre, pelo `gcloud run services proxy` no Mac (não abre no celular). O APK de QA fala direto com a API de QA, que exige a chave de QA.
- **Produção espera meu clique:** o merge em `main` deixa o deploy pendente até eu aprovar no ambiente `production` do GitHub.
- **`prev` é aposentada:** o trabalho dela entra em `development` por PR antes de qualquer coisa desta feature; a branch só é apagada com meu OK explícito na hora.
- **Fluxo:** `feat/*` → PR em `development` (CI verde obrigatório) → merge dispara deploy em QA → PR `development` → `main` (CI verde) → merge dispara deploy em Produção.
- **Correção urgente:** `hotfix/*` → PR em `main` → depois volta para `development` (PR).
- **Sem chave de serviço no GitHub:** o Actions entra no Google Cloud por Workload Identity Federation (token OIDC de curta duração). Nenhum JSON de conta de serviço existe, em lugar nenhum.

## O que o sistema precisa garantir

- **Ordem do deploy:** imagens publicadas → migração (`prisma migrate deploy` num Cloud Run Job, pela conexão direta) → nova revisão da API → nova revisão da web. Migração falhou: nada é publicado e a revisão anterior segue servindo.
- **Migrações compatíveis com a revisão anterior:** como a migração roda antes da troca de revisão, a revisão velha convive com o schema novo por alguns segundos. Remoção/renomeação de coluna é feita em dois deploys (expandir, depois contrair).
- **Isolamento:** QA nunca escreve no banco de Produção (a branch Neon é cópia, não espelho); a chave de API de QA não abre a Produção, e vice-versa — inclusive depois de um reset da cópia, que traz de volta o registro da chave de Produção e precisa removê-lo.
- **Dado real fora da Produção só atrás de login:** a web de QA não aceita acesso anônimo; a API de QA não aceita a chave de Produção.
- **Recopiar é um comando:** atualizar QA com os dados de hoje da Produção (reset da branch Neon a partir da principal) é um script documentado que termina com QA reaplicando suas migrações pendentes e **removendo da cópia toda chave de API que não seja a de QA** (a de Produção vem junto na cópia). A chave de QA não é rotacionada pelo reset; rotacionar é gravar nova versão do secret de QA e rodar seed + rekey.
- **A cópia continua sendo do mesmo usuário:** o seed de QA registra a chave de QA no `User` copiado da Produção (mesmo e-mail), nunca num usuário novo e vazio.
- **Imagens de Produção sobrevivem ao ritmo do QA:** as imagens usadas por Produção (a atual e as de rollback) nunca são apagadas por deploys de QA, quantos forem.
- **`main` não recebe push direto de ninguém**, nem admin; só PR de `development` ou `hotfix/*` com CI verde.
- **Um deploy por ambiente por vez:** dois merges seguidos em `development` não se atropelam; o segundo espera o primeiro.
- **Só código que passou no CI vai para um ambiente:** o deploy roda sobre o commit mergeado e depende do CI desse mesmo commit.
- **Segredos nunca em texto no repositório** (repo é público): URLs de banco e chaves ficam no Secret Manager; o GitHub guarda só identificadores não secretos (projeto, provider WIF, e-mail da conta de serviço) como *variables*.
- **Voltar atrás é um comando:** reverter o tráfego para a revisão anterior do Cloud Run está documentado. Migração não se desfaz sozinha.

## Está pronto quando

- [ ] `prev` mergeada em `development` por PR **antes** do primeiro PR desta feature; nenhuma branch apagada sem autorização registrada do usuário.
- [ ] PR para `development` com CI vermelho não pode ser mergeado (botão bloqueado).
- [ ] PR para `main` com CI vermelho não pode ser mergeado; push direto em `main` é recusado, inclusive para o dono do repositório (sem bypass de admin).
- [ ] Merge em `development` publica nova revisão de `indice-api-qa` e `indice-web-qa` com a imagem do commit mergeado (tag = SHA), sem ação manual além do merge.
- [ ] Merge em `main` publica nova revisão de `indice-api` e `indice-web` só depois de o Andre aprovar o deploy pendente no ambiente `production`; sem aprovação, nada muda em Produção.
- [ ] Migração nova mergeada em `development` aparece aplicada no banco de QA (`_prisma_migrations`) e **não** no de Produção até o merge em `main`.
- [ ] Migração com erro faz o workflow falhar antes de `gcloud run deploy`; a URL do ambiente continua respondendo com a revisão anterior.
- [ ] `GET /health` da API de QA responde 200; `GET /habits/today` da API de QA responde 200 com a chave de QA e 401 com a chave de Produção (e o inverso na Produção). Vale também logo após rodar o reset de QA.
- [ ] Abrir a URL `*.run.app` de `indice-web-qa` numa janela anônima responde 403; pelo `gcloud run services proxy indice-web-qa` com a conta do Andre, a página carrega com os dados copiados.
- [ ] Rodar o script de reset de QA deixa a branch Neon `qa` com os dados atuais da Produção, as migrações de `development` aplicadas e só a chave de QA válida; `GET /habits/today` com a chave de QA devolve os dados copiados (não lista vazia), e a tabela `User` de `qa` tem o mesmo número de linhas da Produção.
- [ ] Imagens de QA e de Produção ficam em repositórios separados do Artifact Registry, cada um com política de limpeza **efetiva** (não *dry run*) que mantém as 10 versões mais recentes; a imagem que serve Produção continua existindo depois de 11 deploys de QA seguidos.
- [ ] Build sem `_TAG` falha antes de publicar qualquer imagem.
- [ ] O repositório não contém nenhuma connection string, chave de API nem JSON de conta de serviço (busca por `postgresql://`, `private_key`, valores das chaves → zero ocorrências fora de exemplos com placeholder).
- [ ] O provider WIF recusa token de outro repositório (condição `assertion.repository`), e o ambiente `production` do GitHub só aceita deploy a partir de `main`.
- [ ] O README de `infra/cloudrun` descreve: preparar um ambiente do zero, o fluxo de branches, como reverter uma revisão e como gerar o APK apontando para QA.

## Fora do escopo

- **Autenticação na web.** Hoje `indice-web` é pública e sem login (a chave fica no servidor) — qualquer um com a URL vê os dados. Registrado no INBOX; não é resolvido aqui para Produção. Em QA a mitigação é fechar o serviço por IAM (acima).
- **APK publicado pelo CI.** O repositório é público: artefatos do Actions são baixáveis por qualquer conta GitHub, e o APK carrega a chave de API. O APK de QA é gerado localmente com `-Pindice.apiBaseUrl`/`-Pindice.apiKey` (já suportado pelo `build.gradle.kts`); distribuição automática (ex. Firebase App Distribution) fica para depois.
- **APK de QA ao lado do de Produção.** O APK de QA usa o mesmo `applicationId` (`dev.indice.app`) e substitui o de Produção no aparelho; isso fica documentado no README. Instalar os dois lado a lado (`applicationIdSuffix`) é mudança no Android, fora desta feature: candidata a 003 no INBOX (decisão do Luke, 2026-10-20).
- Ambientes efêmeros por PR, domínio próprio, Terraform, Cloud SQL, monitoramento/alertas.
- Rollback automático de migração.

## Decisões do usuário (2026-10-20)

1. Um projeto GCP, sufixo `-qa`. 2. Aprovação manual em Produção, Andre revisor. 3. QA sempre implantado, escala a zero. 4. `main` sem push direto para ninguém, sem bypass. 5. `prev` aposentada (PR para `development`; apagar só com autorização no momento). 6. QA com cópia dos dados reais (branch Neon filha da Produção) — contra a recomendação; mitigação em `plan.md`.
