# Deploy no Google Cloud

Dois ambientes no mesmo projeto GCP, na região `southamerica-east1`:

| | Produção | QA |
|---|---|---|
| Serviços Cloud Run | `indice-api`, `indice-web` | `indice-api-qa`, `indice-web-qa` |
| Jobs | `indice-migrate`, `indice-seed` | `indice-migrate-qa`, `indice-seed-qa`, `indice-rekey-qa` |
| Banco (Neon) | branch principal | branch `qa`, filha da principal (cópia dos dados) |
| Imagens (Artifact Registry) | `indice` | `indice-qa` |
| Secrets | `indice-database-url`, `indice-database-url-direct`, `indice-api-key`, `indice-allowed-emails` | `indice-qa-database-url`, `indice-qa-database-url-direct`, `indice-qa-api-key`, `indice-qa-allowed-emails` |
| Neon Auth | habilitado na branch principal | herdado no reset da `qa`; config de QA reaplicada pelo `qa-reset.sh` |
| Web | pública, com login | fechada por IAM (só a conta do Andre, pelo proxy), com login |
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
5. Nova revisão da web, apontando para a API do mesmo ambiente. A web não recebe
   chave de API: ela autentica pelo login (`--remove-secrets INDICE_API_KEY_WEB`
   tira o secret das revisões antigas; confira no primeiro deploy que o flag não
   reclama de secret ausente).

Substituições, por ambiente (os padrões do arquivo são os de Produção):

| | Produção | QA |
|---|---|---|
| `_TAG` | SHA do commit (obrigatória) | SHA do commit (obrigatória) |
| `_REPO` | `indice` | `indice-qa` |
| `_SUFFIX` | `""` | `-qa` |
| `_WEB_AUTH` | `--allow-unauthenticated` | `--no-allow-unauthenticated` |
| `_DB_SECRET` | `indice-database-url` | `indice-qa-database-url` |
| `_DB_DIRECT_SECRET` | `indice-database-url-direct` | `indice-qa-database-url-direct` |
| `_AUTH_BASE_URL` | Auth URL da branch principal (padrão do arquivo) | Auth URL da branch `qa` (`deploy.yml`) |
| `_AUTH_WEB_ORIGIN` | vazia: usa a URL de `indice-web` | `http://127.0.0.1:3100` (origem do proxy) |
| `_ALLOWED_EMAILS_SECRET` | `indice-allowed-emails` | `indice-qa-allowed-emails` |

A API recebe `NEON_AUTH_BASE_URL`, `AUTH_WEB_ORIGIN` (env, não são segredos) e
`INDICE_ALLOWED_EMAILS` (secret). Em produção ela recusa subir sem os três.
`_API_KEY_SECRET` não existe mais: a web não usa chave.

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
o pool/provider de Workload Identity, a conta `gh-deployer` e seus papéis
(inclui o papel customizado `indiceBucketLister`, só `storage.buckets.list` no
projeto: o `gcloud builds submit` lista os buckets para checar que
`<projeto>_cloudbuild` é do projeto), o repositório `indice-qa`, a política de limpeza nos dois repositórios (efetiva,
fora do modo de teste), os secrets de QA e os das listas de e-mails
permitidos, `indice-allowed-emails` e `indice-qa-allowed-emails` (lendo
os valores do terminal, sem eco; e-mails separados por vírgula), os jobs `indice-seed-qa` e `indice-rekey-qa`,
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

Desfazer o papel `indiceBucketLister`: primeiro o vínculo, depois o papel. Sem ele,
o `builds submit` do deploy volta a dar 403 no bucket.

```bash
gcloud projects remove-iam-policy-binding indice-509203 --condition None \
  --member serviceAccount:gh-deployer@indice-509203.iam.gserviceaccount.com \
  --role projects/indice-509203/roles/indiceBucketLister
gcloud iam roles delete indiceBucketLister --project indice-509203
```

Papel apagado fica reservado por cerca de 37 dias: o nome não pode ser recriado
com `create` nesse prazo. Para voltar, use
`gcloud iam roles undelete indiceBucketLister --project indice-509203` (o
`bootstrap.sh` faz isso sozinho se encontrar o papel apagado).

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
  --substitutions "_TAG=$(git rev-parse HEAD),_REPO=indice-qa,_SUFFIX=-qa,_WEB_AUTH=--no-allow-unauthenticated,_DB_SECRET=indice-qa-database-url,_DB_DIRECT_SECRET=indice-qa-database-url-direct,_ALLOWED_EMAILS_SECRET=indice-qa-allowed-emails,_AUTH_BASE_URL=<auth-url-da-branch-qa>,_AUTH_WEB_ORIGIN=http://127.0.0.1:3100"
```

Depois do primeiro deploy de QA, rode o `bootstrap.sh` de novo: ele só
consegue dar o `run.invoker` em `indice-web-qa` (sua conta) e em `indice-api-qa`
(`allUsers`) quando os serviços existem. O deploy pede `--allow-unauthenticated`
para a API, mas roda com a SA do build, que não tem `run.services.setIamPolicy`:
o build só avisa ("Setting IAM policy failed") e a API de QA fica privada, com
403 antes de a chave ser conferida. A web de QA nunca recebe `allUsers`.

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

A chave de cada ambiente serve só a automações (Cloud Scheduler, scripts, curl),
sempre ligada ao usuário dono. A web e o APK entram pelo login (abaixo).

## Login e lista de e-mails permitidos

Web e Android exigem login com e-mail e senha (Neon Auth, mediado pela API em
`/auth/*`). Só entra quem tem conta com e-mail verificado **e** o e-mail na
lista do ambiente (`INDICE_ALLOWED_EMAILS`, conferida em toda requisição). Uma
conta criada direto no Neon Auth, fora da lista, não recebe nada da API.

A lista é o secret `indice-allowed-emails` (Produção) ou
`indice-qa-allowed-emails` (QA), e-mails separados por vírgula. Só a API lê o
secret, na subida da revisão. Para adicionar ou remover uma pessoa, grave a lista
**inteira** como versão nova e force uma revisão nova da API. O valor é digitado
no terminal (sem eco), nunca em argumento nem em arquivo do repositório:

```bash
S=indice-allowed-emails      # QA: indice-qa-allowed-emails
API=indice-api               # QA: indice-api-qa
REGION=southamerica-east1
gcloud secrets versions access latest --secret $S      # lista atual, para editar
printf 'Lista completa: '; IFS= read -rs LIST; echo
printf '%s' "$LIST" | gcloud secrets versions add $S --data-file=-; unset LIST
gcloud run services update $API --region $REGION --update-labels allowlist=$(date +%Y%m%d%H%M)
```

Quem sai da lista recebe 403 em toda rota assim que a revisão nova sobe (o JWT
de 15 minutos não ajuda, porque a lista é conferida a cada requisição). Quando
quiser, desabilite as versões antigas do secret:
`gcloud secrets versions disable <n> --secret $S`.

### Config do Neon Auth

Por branch Neon (`neonctl neon-auth ...`): e-mail e senha, verificação por código
no cadastro, SMTP compartilhado do Neon (remetente `auth@mail.myneon.app`, nome "Neon Auth": o provider compartilhado ignora `--sender-name`). Produção: Allow Localhost **desligado** e o
domínio confiável é a URL de `indice-web`. QA: domínio confiável
`http://127.0.0.1:3100` e Allow Localhost ligado. O `qa-reset.sh` reaplica a de
QA depois de cada reset.

### APK sem chave

O APK não embute mais a chave de API: o login dá o acesso. O build de release
exige só `-Pindice.apiBaseUrl` (ver "APK apontando para QA").

### Rotacionar a `indice-api-key` de Produção

O APK antigo leva a chave embutida e continua abrindo a API até ela ser
rotacionada. Faça **depois** de o APK novo estar instalado no aparelho:

```bash
REGION=southamerica-east1
openssl rand -base64 32 | tr -d '\n' | gcloud secrets versions add indice-api-key --data-file=-
# atualize a chave nos automatismos (ex.: o header do Cloud Scheduler abaixo)
gcloud run jobs execute indice-seed --region $REGION --wait   # registra a chave nova
```

O seed só registra a chave nova; a antiga continua válida até o `rekey`, que
apaga toda `ApiKey` que não seja a do secret. Produção não tem esse job; crie-o
uma vez, com o mesmo script do `REKEY_SCRIPT` do `bootstrap.sh`, trocando os
secrets de QA pelos de Produção (`indice-database-url-direct` e
`indice-api-key`), e execute-o. Depois confira: o APK antigo recebe 401 e o novo
(login) segue funcionando.

## Acessar a web de QA

A web de QA mostra uma cópia dos dados reais e fica fechada por IAM, então não
aceita acesso anônimo (a URL `*.run.app` responde 403). Dentro dela há o login
normal, com a lista de QA; abra sempre pela porta 3100, porque
`http://127.0.0.1:3100` é a origem confiável do Neon Auth de QA. Pelo Mac, com a sua conta
Google no `gcloud`:

```bash
gcloud run services proxy indice-web-qa --region southamerica-east1 --port 3100
# abra http://127.0.0.1:3100 (o proxy escuta só em IPv4; localhost pode ir para ::1)
```

Não abre no celular. A API de QA continua pública (o APK precisa dela) e exige
login (ou a chave de QA, para automações); a chave de Produção não abre QA, e
vice-versa. Um login de Produção também não vale em QA: a API confere o emissor
do JWT, e as chaves de assinatura de QA e de Produção são diferentes.

## Recopiar a Produção para QA: `qa-reset.sh`

```bash
export NEON_API_KEY=...  NEON_PROJECT_ID=...
infra/cloudrun/qa-reset.sh
```

Antes de tudo confere que a `qa` **não tem branch filha** (o Neon recusa o reset
com filha; se houver, o script imprime `falhou: qa tem filha <nome>` e para). A
branch Neon `dev`, usada só para o login no desenvolvimento local, é filha da
**principal**, nunca da `qa`: crie-a com
`neonctl branches create --name dev --parent <branch-principal> --no-secrets` e,
logo depois, troque a senha do `neondb_owner` dela (a filha herda a da Produção)
sem gravar o valor, pela API do Neon (`reset_password`). Nunca puxe a connection
string da `dev`: o app local usa o Postgres do compose, e a `dev` serve só ao
Auth (o `.env` recebe só o `NEON_AUTH_BASE_URL`).

Depois reseta a branch Neon `qa` a partir da principal (dados de hoje da Produção),
roda `qa-db-password.sh` (abaixo), reaplica a config do Neon Auth de QA (e-mail e
senha, Allow Localhost, domínio confiável) e confere que a Auth
URL da `qa` é a da API de QA (`falhou` e para se divergir). O reset preserva a Auth
URL e a config, mas traz de volta os usuários e as sessões da principal: **as
sessões de QA caem no reset** e é preciso entrar de novo. Em seguida roda
`indice-migrate-qa` (reaplica as migrações de `development` que ainda não
estão em Produção), `indice-seed-qa` e `indice-rekey-qa`. O rekey apaga em QA
toda `ApiKey` que não seja a de QA — a cópia traz o registro da chave de
Produção.

O reset **não rotaciona** a chave de QA: ela continua sendo a versão `latest`
de `indice-qa-api-key`, e o APK de QA já instalado segue funcionando.

**Resete só por este script**, nunca pelo painel do Neon: um reset sem o rekey
deixa a chave de Produção abrindo QA, e o reset pelo painel também devolve à `qa`
a senha de banco da Produção (QA para de conectar, porque o secret tem a senha de
QA). Se resetou pelo painel, rode o script.

### Senha de banco própria de QA: `qa-db-password.sh`

O Neon copia para a branch filha os papéis **com as mesmas senhas** da mãe, e o
`reset --parent` copia de novo: sem tratamento, a URL de QA abre a Produção
trocando só o host. `infra/cloudrun/qa-db-password.sh` troca a senha do
`neondb_owner` só na branch `qa` (API do Neon), grava versão nova dos dois
secrets de QA (trocando só a senha na URL, em memória), confere que a senha nova
difere da de Produção, que o host de QA a aceita e o de Produção a recusa, e só
então desabilita e destrói as versões antigas (até 3 tentativas de destroy por
versão) e cria revisão nova de `indice-api-qa`. Imprime só `ok`/`falhou`; a senha
não passa por argumento, tela nem arquivo. `qa-db-password: ok` só sai com todas
as versões antigas DESTROYED e a revisão nova criada.

```bash
NEON_API_KEY=... NEON_PROJECT_ID=... infra/cloudrun/qa-db-password.sh   # da raiz, com npm ci feito
```

O `qa-reset.sh` já o chama logo depois do reset. Rode à mão uma vez depois de
criar a branch `qa`, e sempre que a `qa` for resetada fora do script. Rodar de
novo é sempre seguro: troca a senha outra vez e trata como antiga toda versão não
destruída (inclusive as já desabilitadas).

Estado que sobra se ele parar no meio:

| Onde parou | Estado | Risco |
|---|---|---|
| antes de gravar os secrets (`falhou`) | branch com senha nova, secrets com a antiga | QA não conecta; nada vaza |
| conferência (`falhou`, ex.: Produção aceitou a credencial) | versões novas gravadas; antigas intactas | pare e avise: nada foi destruído |
| `INCOMPLETO` no disable | versão antiga ainda ENABLED (lida só por número de versão; o `latest` já é a nova) | a senha de Produção segue no Secret Manager: rode de novo |
| `INCOMPLETO` no destroy | versões antigas DISABLED (ninguém lê sem reabilitar) | rode de novo para destruir |
| `INCOMPLETO` na revisão | secrets certos; `indice-api-qa` ainda na revisão anterior (sem conectar) | rode de novo, ou `gcloud run services update indice-api-qa --region southamerica-east1 --update-labels qa-db-password=<agora>` |

## Rotacionar a chave de QA

```bash
REGION=southamerica-east1
# nova versão do secret (gerada aqui, sem passar por argumento nem tela)
openssl rand -base64 32 | tr -d '\n' | gcloud secrets versions add indice-qa-api-key --data-file=-
gcloud run jobs execute indice-seed-qa --region $REGION --wait    # registra a chave nova
gcloud run jobs execute indice-rekey-qa --region $REGION --wait   # apaga as outras, inclusive a antiga
```

A chave de QA serve só a automações e scripts (a web e o APK usam o login). A
antiga para de funcionar no rekey.

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

O CI não publica APK. Gere localmente:

```bash
API_QA=$(gcloud run services describe indice-api-qa --region southamerica-east1 --format 'value(status.url)')
cd apps/android
./gradlew :app:assembleRelease -Pindice.apiBaseUrl="$API_QA/"
```

A barra final da URL é obrigatória (Retrofit). Para Produção, o mesmo com
`indice-api`. O APK não leva chave: quem entra é quem faz login.

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
