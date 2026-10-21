# Deploy no Google Cloud

Dois ambientes no mesmo projeto GCP, na região `southamerica-east1`:

| | Produção | QA |
|---|---|---|
| Serviços Cloud Run | `indice-api`, `indice-web` | `indice-api-qa`, `indice-web-qa` |
| Jobs | `indice-migrate`, `indice-seed` | `indice-migrate-qa`, `indice-seed-qa`, `indice-rekey-qa` |
| Banco (Neon) | branch principal | branch `qa`, filha da principal (cópia dos dados) |
| Imagens (Artifact Registry) | `indice` | `indice-qa` |
| Secrets | `indice-database-url`, `indice-database-url-direct`, `indice-api-key` | `indice-qa-database-url`, `indice-qa-database-url-direct`, `indice-qa-api-key` |
| Web | pública | fechada por IAM (só a conta do Andre, pelo proxy) |
| Deploy | merge em `main`, após aprovação no Environment `production` | merge em `development` |

Topologia: Cloud Run (escala a zero) + Postgres externo (Neon, plano gratuito) +
Artifact Registry + Secret Manager + Cloud Build. O banco fica fora do Google
porque uma instância Cloud SQL, mesmo a menor, consome sozinha o orçamento de um
projeto pessoal.

Nenhum segredo vive neste repositório (ele é público): URLs de banco e chaves
ficam no Secret Manager; o GitHub guarda só identificadores (projeto, provider
WIF, e-mail da conta de serviço) como *variables*. Não existe chave JSON de
conta de serviço: o Actions entra no Google Cloud por Workload Identity
Federation.

## Fluxo de branches

```
feat/*    ──PR (CI verde)──▶ development ──merge──▶ deploy QA
development ──PR (CI verde)──▶ main ──merge──▶ deploy Produção (após aprovação)
hotfix/*  ──PR (CI verde)──▶ main, depois PR main ──▶ development
```

- `main` e `development` só aceitam PR com os checks `node` e `android` verdes.
  Ninguém faz push direto em `main`, nem admin.
- O deploy (`.github/workflows/deploy.yml`) roda o CI de novo sobre o commit
  mergeado e só então chama `gcloud builds submit` com este `cloudbuild.yaml`.
- Um deploy por ambiente por vez: dois merges seguidos enfileiram, não cancelam
  (cancelar no meio pode deixar migração aplicada sem revisão nova).
- **Aprovação de Produção:** o merge em `main` deixa o job `deploy` pendente no
  Environment `production`. Aprove em *Actions → execução → Review deployments*.
  Sem aprovação, nada muda em Produção.

## O que o deploy faz

`cloudbuild.yaml`, nesta ordem:

1. Confere que `_TAG` foi passada (sem ela, para antes de construir).
2. Constrói e publica `indice-api:<sha>` e `indice-web:<sha>` (tag = SHA
   completo do commit) no repositório do ambiente (`_REPO`).
3. `prisma migrate deploy` no job `indice-migrate<sufixo>`, pela conexão direta.
   Falhou: o build para e a revisão anterior continua servindo.
4. Nova revisão da API (`CORS_ORIGIN` = URL da web do mesmo ambiente).
5. Nova revisão da web, apontando para a API do mesmo ambiente.

Substituições, por ambiente (os padrões do arquivo são os de Produção):

| | Produção | QA |
|---|---|---|
| `_TAG` | SHA do commit (obrigatória) | SHA do commit (obrigatória) |
| `_REPO` | `indice` | `indice-qa` |
| `_SUFFIX` | `""` | `-qa` |
| `_WEB_AUTH` | `--allow-unauthenticated` | `--no-allow-unauthenticated` |
| `_DB_SECRET` | `indice-database-url` | `indice-qa-database-url` |
| `_DB_DIRECT_SECRET` | `indice-database-url-direct` | `indice-qa-database-url-direct` |
| `_API_KEY_SECRET` | `indice-api-key` | `indice-qa-api-key` |

As imagens de cada ambiente ficam num repositório próprio do Artifact Registry,
cada um com limpeza que mantém as 10 versões mais recentes de cada imagem.
Separados, os deploys de QA nunca apagam a imagem que serve Produção nem as de
rollback.

### Migrações: expandir, depois contrair

A migração roda antes da troca de revisão, então a revisão antiga convive com o
schema novo por alguns segundos (e por mais tempo, se o deploy falhar depois da
migração). Toda migração precisa funcionar com o código anterior:

- Adicionar coluna: nullable ou com default.
- Remover ou renomear coluna: dois deploys. Primeiro o código para de usar a
  coluna (e, se for renomear, escreve nas duas); só no deploy seguinte a
  migração remove a antiga.

Migração não se desfaz sozinha: reverter a revisão (abaixo) não reverte o banco.

## Preparar um ambiente do zero

Pré-requisitos: `gcloud` autenticado com uma conta dona do projeto,
`openssl`, e para QA o `neonctl` (`npm i -g neonctl`).

### 1. Banco

**Produção:** projeto Neon Postgres 17, branch principal.
**QA:** no mesmo projeto Neon, crie a branch `qa` **filha da principal** (cópia
dos dados de hoje), com compute próprio e autosuspend:

```bash
export NEON_API_KEY=...        # só no seu terminal; nunca no repo nem no GitHub
neonctl branches create --project-id <projeto-neon> --name qa --parent <branch-principal>
```

De cada branch guarde **duas** connection strings:

- **pooler** (host com `-pooler`) — a que a API usa em runtime. Acrescente
  `?pgbouncer=true&connection_limit=1`: o serviço escala a zero e o pooler em
  modo transação não suporta os statements preparados de um pool próprio.
- **direta** (host sem `-pooler`) — a das migrações, do seed e do rekey.
  `prisma migrate deploy` roda DDL e advisory locks, que não passam pelo pooler.

### 2. Projeto GCP, WIF e QA: `bootstrap.sh`

`infra/cloudrun/bootstrap.sh` é idempotente (pode rodar de novo): só cria o que
falta. Ele confere o e-mail do usuário do app contra o seed de Produção, cria
o pool/provider de Workload Identity, a conta `gh-deployer` e seus papéis, o
repositório `indice-qa`, a política de limpeza nos dois repositórios (efetiva,
fora do modo de teste), os secrets de QA (lendo
os valores do terminal, sem eco), os jobs `indice-seed-qa` e `indice-rekey-qa`,
e dá `roles/run.invoker` em `indice-web-qa` à sua conta. Os e-mails entram como
argumento, nunca no repo. Veja o cabeçalho do script para uso e variáveis.

```bash
infra/cloudrun/bootstrap.sh <email-acesso-web-qa> <email-usuario-app>
```

O `<email-usuario-app>` tem de ser o do usuário da Produção: o seed de QA faz
upsert por e-mail e, com outro e-mail, criaria um usuário vazio em vez de usar o
da cópia. Se o job `indice-seed` existe, o script compara com o
`INDICE_USER_EMAIL` dele (sem a variável, o seed usou o padrão
`andre@indice.local`) e aborta se divergir.

No fim ele imprime os valores de `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER` e
`GCP_DEPLOY_SA`: crie-os em *Settings → Secrets and variables → Actions →
Variables* do repositório (não são segredos).

Os secrets de Produção já existem. Para recriar Produção do zero:

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudbuild.googleapis.com
gcloud artifacts repositories create indice --repository-format=docker \
  --location=southamerica-east1
# Valor digitado no terminal, nunca em argumento: Ctrl-D encerra.
gcloud secrets create indice-database-url --data-file=-          # URL do pooler
gcloud secrets create indice-database-url-direct --data-file=-   # URL direta
openssl rand -base64 32 | tr -d '\n' | gcloud secrets create indice-api-key --data-file=-
```

A conta que roda o Cloud Build e a do Cloud Run (por padrão a conta de serviço
padrão do Compute) precisam de `roles/secretmanager.secretAccessor`.

### 3. Primeiro deploy

Pelo Actions: merge em `development` (QA) ou em `main` (Produção). Manual, com
o mesmo arquivo (o `_TAG` é obrigatório):

```bash
# Produção
gcloud builds submit --config infra/cloudrun/cloudbuild.yaml \
  --substitutions "_TAG=$(git rev-parse HEAD),_REPO=indice"
# QA
gcloud builds submit --config infra/cloudrun/cloudbuild.yaml \
  --substitutions "_TAG=$(git rev-parse HEAD),_REPO=indice-qa,_SUFFIX=-qa,_WEB_AUTH=--no-allow-unauthenticated,_DB_SECRET=indice-qa-database-url,_DB_DIRECT_SECRET=indice-qa-database-url-direct,_API_KEY_SECRET=indice-qa-api-key"
```

Depois do primeiro deploy de QA, rode o `bootstrap.sh` de novo: ele só
consegue dar o `run.invoker` em `indice-web-qa` quando o serviço existe.

### 4. Seed (uma vez por ambiente)

Obrigatório: em produção a API recusa a chave de desenvolvimento, então sem o
seed toda requisição responde 401. O seed cria (ou mantém) o usuário, as
categorias, os hábitos e a meta inicial, e registra o hash da chave do
ambiente.

**QA:** não precisa de seed separado; rode o reset (abaixo), que faz migrate,
seed e rekey.

**Produção** (o e-mail é o do usuário do app; passe pelo terminal):

```bash
REGION=southamerica-east1
IMAGE=$(gcloud run services describe indice-api --region $REGION \
  --format 'value(spec.template.spec.containers[0].image)')
gcloud run jobs deploy indice-seed --image $IMAGE --region $REGION \
  --set-secrets DATABASE_URL=indice-database-url-direct:latest,INDICE_API_KEY=indice-api-key:latest \
  --set-env-vars INDICE_USER_EMAIL=<email-do-usuario> \
  --command node --args "packages/db/dist/seed.js"
gcloud run jobs execute indice-seed --region $REGION --wait
```

A chave de cada ambiente alimenta o `INDICE_API_KEY_WEB` da web desse ambiente
(o `cloudbuild.yaml` já faz isso) e o `API_KEY` do APK correspondente.

## Acessar a web de QA

A web de QA mostra uma cópia dos dados reais e não tem login, então não aceita
acesso anônimo (a URL `*.run.app` responde 403). Pelo Mac, com a sua conta
Google no `gcloud`:

```bash
gcloud run services proxy indice-web-qa --region southamerica-east1 --port 3100
# abra http://localhost:3100
```

Não abre no celular. A API de QA continua pública (o APK precisa dela) e exige
a chave de QA; a chave de Produção não abre QA, e vice-versa.

## Recopiar a Produção para QA: `qa-reset.sh`

```bash
export NEON_API_KEY=...  NEON_PROJECT_ID=...
infra/cloudrun/qa-reset.sh
```

Reseta a branch Neon `qa` a partir da principal (dados de hoje da Produção),
roda `indice-migrate-qa` (reaplica as migrações de `development` que ainda não
estão em Produção), `indice-seed-qa` e `indice-rekey-qa`. O rekey apaga em QA
toda `ApiKey` que não seja a de QA — a cópia traz o registro da chave de
Produção.

O reset **não rotaciona** a chave de QA: ela continua sendo a versão `latest`
de `indice-qa-api-key`, e o APK de QA já instalado segue funcionando.

**Resete só por este script**, nunca pelo painel do Neon: um reset sem o rekey
deixa a chave de Produção abrindo QA. Se resetou pelo painel, rode o script.

## Rotacionar a chave de QA

```bash
REGION=southamerica-east1
# nova versão do secret (gerada aqui, sem passar por argumento nem tela)
openssl rand -base64 32 | tr -d '\n' | gcloud secrets versions add indice-qa-api-key --data-file=-
gcloud run jobs execute indice-seed-qa --region $REGION --wait    # registra a chave nova
gcloud run jobs execute indice-rekey-qa --region $REGION --wait   # apaga as outras, inclusive a antiga
```

Depois, publique uma revisão nova de `indice-web-qa` (merge em `development` ou
deploy manual de QA) para a web ler a chave nova, e regere o APK de QA (abaixo):
a chave antiga para de funcionar no rekey.

## Voltar atrás (rollback)

Reverter o tráfego para a revisão anterior:

```bash
gcloud run revisions list --service indice-api --region southamerica-east1
gcloud run services update-traffic indice-api --region southamerica-east1 \
  --to-revisions <revisao-anterior>=100
# idem para indice-web (e para indice-api-qa / indice-web-qa)
```

Com o tráfego fixado numa revisão, o próximo deploy cria revisão nova mas não
leva tráfego. Para voltar ao normal:
`gcloud run services update-traffic <servico> --region southamerica-east1 --to-latest`.

A migração não é revertida. Se a revisão antiga não funciona com o schema novo,
corrija para frente (nova migração por PR).

## APK apontando para QA

O CI não publica APK (repo público: o artefato carregaria a chave). Gere
localmente:

```bash
API_QA=$(gcloud run services describe indice-api-qa --region southamerica-east1 --format 'value(status.url)')
KEY_QA=$(gcloud secrets versions access latest --secret indice-qa-api-key)
cd apps/android
./gradlew :app:assembleRelease -Pindice.apiBaseUrl="$API_QA/" -Pindice.apiKey="$KEY_QA"
```

A barra final da URL é obrigatória (Retrofit). Para Produção, o mesmo com
`indice-api` e `indice-api-key`.

O build de release não tem `signingConfig`: sai
`app/build/outputs/apk/release/app-release-unsigned.apk`, que o Android só
instala depois de assinado (ex.: `apksigner sign --ks ~/.android/debug.keystore
--ks-pass pass:android --out indice-qa.apk app-release-unsigned.apk`). O
`applicationId` é o mesmo da Produção, então o APK de QA substitui o de
Produção no aparelho.

## Snapshots diários de metas (Cloud Scheduler)

```bash
gcloud scheduler jobs create http indice-goal-snapshots --location southamerica-east1 \
  --schedule "0 3 * * *" --time-zone America/Sao_Paulo \
  --uri "$(gcloud run services describe indice-api --region southamerica-east1 --format 'value(status.url)')/goals/ID/snapshot" \
  --http-method POST --headers "X-Api-Key=CHAVE"
```
