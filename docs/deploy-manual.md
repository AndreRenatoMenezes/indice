# Deploy manual no Cloud Run, passo a passo

Guia para subir o Índice sem o `cloudbuild.yaml`, executando cada etapa à mão e
entendendo o que cada comando faz. O pipeline automatizado continua em
`infra/cloudrun/cloudbuild.yaml` e faz exatamente estas mesmas operações.

**Topologia final:** Postgres no Neon (plano gratuito), imagens no Artifact
Registry, dois serviços Cloud Run (`indice-api` e `indice-web`) e dois Cloud Run
Jobs efêmeros (migração e seed). Senhas e chaves no Secret Manager.

**Ordem importa.** O banco precisa existir antes das migrações; as migrações
antes do seed; o seed antes de qualquer requisição autenticada. Pular o seed é
o erro mais comum e se manifesta como `401` em tudo.

---

## 0. Pré-requisitos

O Docker já está instalado nesta máquina. O `gcloud` não:

```bash
brew install --cask google-cloud-sdk
```

O instalador do Homebrew não mexe no seu `PATH` sozinho. Se `gcloud --version`
não responder depois, adicione ao `~/.zshrc`:

```bash
source "$(brew --prefix)/share/google-cloud-sdk/path.zsh.inc"
```

Autentique. O comando abre o navegador; é a única etapa que não roda sozinha:

```bash
gcloud auth login
```

Isso guarda credenciais de usuário para os comandos `gcloud`. Para que
bibliotecas e o Docker também consigam falar com o Google, rode:

```bash
gcloud auth configure-docker southamerica-east1-docker.pkg.dev
```

Esse comando grava um helper de credenciais no `~/.docker/config.json`, de modo
que `docker push` para o Artifact Registry use seu login do Google em vez de
pedir senha.

---

## 1. Banco no Neon

No painel do projeto `winter-rice-45624313`, branch `production`, abra
**Connect** e copie as duas formas da connection string:

| forma | host | uso |
|---|---|---|
| pooler | `ep-xxx-pooler.sa-east-1.aws.neon.tech` | runtime da API |
| direta | `ep-xxx.sa-east-1.aws.neon.tech` | migrações e seed |

São necessárias as duas. A API escala a zero e abre muitas conexões curtas —
é o caso de uso do pooler. Mas `prisma migrate deploy` executa DDL e pega
advisory locks no Postgres, que o pooler em modo transação não mantém entre
statements; pelo pooler, a migração trava ou falha.

Monte as URLs finais assim, sem colá-las em lugar nenhum que fique salvo:

- pooler: `...neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1`
- direta: `...neon.tech/neondb?sslmode=require`

`sslmode=require` não é opcional: o Neon só aceita TLS e o Prisma não assume
isso sozinho. `connection_limit=1` evita que cada instância do Cloud Run abra
um pool próprio em cima de um pool que já existe.

### Teste local antes de gastar deploy

Vale validar o schema contra o Neon real agora, com a URL **direta** no `.env`
da raiz como `DATABASE_URL` (a CLI do Prisma encontra esse arquivo por causa de
`packages/db/prisma.config.ts`, que carrega o `.env` da raiz):

```bash
npm run db:deploy   # aplica as migrações
npm run db:seed     # cria usuário, categorias, hábitos e a chave de API
```

Se isso funcionar, o resto é infraestrutura. Se falhar, o problema é de banco e
seria muito mais caro de diagnosticar dentro de um container no Cloud Run.

---

## 2. Projeto no Google Cloud

```bash
export PROJECT_ID=indice-prod           # escolha um id único globalmente
export REGION=southamerica-east1        # São Paulo, menor latência daqui
gcloud projects create $PROJECT_ID
gcloud config set project $PROJECT_ID
```

`gcloud config set project` grava o projeto ativo na sua configuração local,
para não repetir `--project` em cada comando adiante.

Vincule uma conta de faturamento. Mesmo consumindo só créditos, o Cloud Run
recusa deploys em projetos sem billing ativo:

```bash
gcloud billing accounts list
gcloud billing projects link $PROJECT_ID --billing-account=XXXXXX-XXXXXX-XXXXXX
```

Ative as APIs que serão usadas. Serviços do Google vêm desligados por padrão em
projeto novo, e o erro de API desativada aparece só na hora do uso:

```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  cloudscheduler.googleapis.com
```

`cloudbuild` fica ativado como saída de emergência: o fluxo manual constrói as
imagens aqui na máquina, mas se a emulação amd64 incomodar, o pipeline do
`infra/cloudrun/cloudbuild.yaml` constrói no Google — veja o passo 5.

---

## 3. Repositório de imagens

```bash
gcloud artifacts repositories create indice \
  --repository-format=docker \
  --location=$REGION \
  --description="Imagens do Índice"
```

O Artifact Registry é onde as imagens Docker ficam guardadas; o Cloud Run só
sabe rodar imagem que esteja lá (ou em outro registro acessível). O nome
completo de uma imagem fica
`southamerica-east1-docker.pkg.dev/$PROJECT_ID/indice/indice-api:TAG`.

---

## 4. Secrets

Três segredos: as duas URLs do banco e a chave de API do Índice.

```bash
read -rs POOLER_URL && printf '%s' "postgresql://neondb_owner:npg_WG4skMlBUw3z@ep-gentle-truth-acwejpd3-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true&connection_limit=1" \
  | gcloud secrets create indice-database-url --data-file=- && unset POOLER_URL

read -rs DIRECT_URL && printf '%s' "postgresql://neondb_owner:npg_WG4skMlBUw3z@ep-gentle-truth-acwejpd3.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require" \
  | gcloud secrets create indice-database-url-direct --data-file=- && unset DIRECT_URL

openssl rand -base64 32 | tr -d '\n' \
  | gcloud secrets create indice-api-key --data-file=-
```

`read -rs` lê a linha sem ecoar na tela e sem gravar no histórico do shell —
essas URLs contêm a senha do banco. `printf '%s'` em vez de `echo` porque o
`echo` acrescenta `\n`, e um newline no fim da connection string quebra o
parser do Prisma. `--data-file=-` faz o `gcloud` ler da entrada padrão, de modo
que o segredo nunca vira argumento de linha de comando (argumentos aparecem em
`ps` e no histórico).

A chave de API é gerada aqui e **você não vai vê-la**. Para lê-la depois:

```bash
gcloud secrets versions access latest --secret=indice-api-key
```

### Permissão de leitura

Por padrão, serviços do Cloud Run rodam com a service account de Compute do
projeto. Ela precisa de permissão explícita para ler segredos:

```bash
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for S in indice-database-url indice-database-url-direct indice-api-key; do
  gcloud secrets add-iam-policy-binding $S \
    --member="serviceAccount:${SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

Sem isso, o deploy é aceito mas o container morre no boot sem conseguir ler
`DATABASE_URL`, e o log mostra um erro de permissão, não de banco.

---

## 5. Construir e publicar a imagem da API

Esta máquina é ARM (Apple Silicon) e o Cloud Run roda `linux/amd64`. Uma imagem
ARM sobe para o registro sem reclamar e falha no start com `exec format error`,
então a plataforma precisa ser explícita:

```bash
docker buildx build --platform linux/amd64 \
  -f apps/api/Dockerfile \
  -t $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-api:v1 \
  --push .
```

O `.` no fim é o contexto de build: a raiz do monorepo, como os Dockerfiles
esperam (eles copiam `packages/` e `apps/`). O `.dockerignore` da raiz mantém
`node_modules`, `dist` e `.next` fora dele.

`--platform linux/amd64` força a arquitetura via QEMU; sem isso sai uma imagem
ARM que o Cloud Run aceita e não consegue executar. A emulação cobra seu preço:
o `npm ci` e o `tsc` levam vários minutos. `--push` envia direto ao Artifact
Registry ao terminar, usando o helper de credenciais do passo 0.

Se a emulação ficar insuportável, o caminho é construir no Google — e aí vale
usar o pipeline pronto, que já faz as duas imagens em máquinas amd64:

```bash
gcloud builds submit --config infra/cloudrun/cloudbuild.yaml
```

Isso executa o fluxo inteiro (build, push, migração e deploy dos dois serviços)
de uma vez, o oposto do passo a passo manual deste guia. `gcloud builds submit
--tag` não serve aqui: ele espera um `Dockerfile` na raiz do contexto e não tem
como apontar para `apps/api/Dockerfile`.

A tag `v1` é sua para escolher. Prefira algo rastreável — `v1`, `2026-09-20`,
ou o SHA do commit — porque é por ela que você faz rollback depois.

---

## 6. Migrar o banco

```bash
gcloud run jobs deploy indice-migrate \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-api:v1 \
  --region $REGION \
  --set-secrets DATABASE_URL=indice-database-url-direct:latest \
  --command npx \
  --args "prisma,migrate,deploy,--schema,packages/db/prisma/schema.prisma" \
  --max-retries 0

gcloud run jobs execute indice-migrate --region $REGION --wait
```

Um Cloud Run Job é um container que roda até terminar, em vez de servir HTTP —
a forma certa de rodar uma tarefa pontual com acesso ao banco. Usa a mesma
imagem da API, que já traz o schema do Prisma e a CLI em `node_modules`.

Note o secret: aqui entra a URL **direta**, mapeada para `DATABASE_URL`. O
schema em `packages/db/prisma/schema.prisma` lê essa variável, então trocar o
valor por contexto é suficiente — nada no código precisa saber da diferença.

`--max-retries 0` evita que uma migração que falhou no meio seja repetida
automaticamente em cima de um banco já parcialmente alterado. `--wait` segura o
terminal até o job terminar e devolve código de saída diferente de zero se
falhar, o que importa se você encadear comandos.

Para ver o que aconteceu:

```bash
gcloud run jobs executions list --job indice-migrate --region $REGION
gcloud logging read \
  'resource.type=cloud_run_job AND resource.labels.job_name=indice-migrate' \
  --limit 50 --format 'value(textPayload)'
```

---

## 7. Subir a API

```bash
gcloud run deploy indice-api \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-api:v1 \
  --region $REGION \
  --platform managed \
  --set-secrets DATABASE_URL=indice-database-url:latest \
  --set-env-vars NODE_ENV=production,TZ=America/Sao_Paulo,CORS_ORIGIN='*' \
  --min-instances 0 \
  --max-instances 2 \
  --cpu 1 \
  --memory 512Mi \
  --allow-unauthenticated
```

Agora o secret é o do **pooler** — este é o processo de longa duração.

`NODE_ENV=production` tem efeito direto na autenticação: em
`apps/api/src/config.ts`, `devApiKey` vira `null` fora de desenvolvimento, e a
chave estática `dev-local-key` deixa de funcionar. É o que torna o passo 8
obrigatório.

`--min-instances 0` é o que mantém a conta perto de zero: sem tráfego, nenhum
container roda e nada é cobrado. O preço é o cold start na primeira requisição
depois de um período ocioso. `--max-instances 2` é um teto de segurança: um bug
em loop não vira uma fatura.

`--allow-unauthenticated` refere-se à autenticação **do Cloud Run**, não à do
Índice. A API precisa ser alcançável pela web e pelo Android, e quem protege é
o `X-Api-Key` do `authPlugin`. Se sua organização tiver a política de
_domain restricted sharing_, este flag é recusado e o serviço só aceitará
chamadas autenticadas pelo IAM.

Guarde a URL:

```bash
API_URL=$(gcloud run services describe indice-api --region $REGION --format 'value(status.url)')
echo $API_URL
```

Teste. A rota `/health` é pública e faz um `SELECT 1` no banco, então ela prova
as duas coisas de uma vez:

```bash
curl $API_URL/health
# {"ok":true,"service":"indice-api","time":"..."}
```

Se responder, o container subiu e o Neon está acessível. Qualquer outra rota
ainda vai responder `401` — correto, o seed não rodou.

---

## 8. Seed (obrigatório)

```bash
gcloud run jobs deploy indice-seed \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-api:v1 \
  --region $REGION \
  --set-secrets DATABASE_URL=indice-database-url-direct:latest,INDICE_API_KEY=indice-api-key:latest \
  --set-env-vars INDICE_USER_EMAIL=arsbdm@gmail.com \
  --command node \
  --args "packages/db/dist/seed.js" \
  --max-retries 0

gcloud run jobs execute indice-seed --region $REGION --wait
```

O seed cria o usuário, as categorias, os hábitos e a meta inicial, e grava o
**hash** da chave de API na tabela `ApiKey`. É isso que faz a chave do Secret
Manager passar a valer em produção: o `authPlugin` procura o hash no banco.

O seed usa `upsert`, então rodá-lo duas vezes não duplica dados.

Confira, agora com a chave:

```bash
API_KEY=$(gcloud secrets versions access latest --secret=indice-api-key)
curl -H "X-Api-Key: $API_KEY" $API_URL/daily-summary
```

JSON de volta significa que a stack de dados está completa.

---

## 9. Construir e subir a web

```bash
docker buildx build --platform linux/amd64 \
  -f apps/web/Dockerfile \
  -t $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-web:v1 \
  --push .

gcloud run deploy indice-web \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-web:v1 \
  --region $REGION \
  --platform managed \
  --set-env-vars API_URL=$API_URL,NEXT_PUBLIC_API_URL=$API_URL,NODE_ENV=production \
  --set-secrets INDICE_API_KEY_WEB=indice-api-key:latest \
  --min-instances 0 \
  --max-instances 2 \
  --cpu 1 \
  --memory 512Mi \
  --allow-unauthenticated
```

A web precisa da mesma chave que o seed registrou — é ela que abre a API. Como
`INDICE_API_KEY_WEB` não tem o prefixo `NEXT_PUBLIC_`, o Next não a expõe ao
navegador: só `apps/web/lib/api.ts`, que roda no servidor, a enxerga.

```bash
WEB_URL=$(gcloud run services describe indice-web --region $REGION --format 'value(status.url)')
open $WEB_URL
```

---

## 10. Fechar o CORS

Com a URL da web conhecida, restrinja a origem da API:

```bash
gcloud run services update indice-api --region $REGION \
  --update-env-vars CORS_ORIGIN=$WEB_URL
```

`--update-env-vars` altera só a variável indicada, preservando as demais —
diferente de `--set-env-vars`, que substitui o conjunto inteiro.

Na prática isso protege pouco, porque o navegador nunca fala com a API (a web é
server-side de ponta a ponta) e CORS não é barreira para clientes fora do
navegador, como o app Android. Mas fecha uma porta que não precisa estar aberta.

---

## 11. Android

```bash
./gradlew :app:assembleRelease \
  -Pindice.apiBaseUrl="$API_URL/" \
  -Pindice.apiKey="$API_KEY"
```

A barra final em `apiBaseUrl` é exigida pelo Retrofit; sem ela o build falha
com uma mensagem sobre `baseUrl` terminando em `/`.

Para não repetir os parâmetros a cada build, coloque-os em
`~/.gradle/gradle.properties`, fora do repositório — a chave não deve ser
commitada.

Este build precisa do `JAVA_HOME` apontando para o JBR do Android Studio ou um
JDK 17+, como descrito em `apps/android/README.md`.

---

## 12. Snapshots diários de metas

Opcional, e só faz sentido depois que existirem metas:

```bash
gcloud scheduler jobs create http indice-goal-snapshots \
  --location $REGION \
  --schedule "0 3 * * *" \
  --time-zone America/Sao_Paulo \
  --uri "$API_URL/goals/ID_DA_META/snapshot" \
  --http-method POST \
  --headers "X-Api-Key=$API_KEY"
```

O Cloud Scheduler chama a URL no horário marcado. A rota aceita POST com corpo
vazio graças ao parser configurado em `apps/api/src/app.ts`.

---

## Atualizar depois

Para publicar uma versão nova, os passos são build, migrar se houver migração
nova, e deploy:

```bash
docker buildx build --platform linux/amd64 -f apps/api/Dockerfile \
  -t $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-api:v2 --push .
gcloud run jobs update indice-migrate --image .../indice-api:v2 --region $REGION
gcloud run jobs execute indice-migrate --region $REGION --wait
gcloud run deploy indice-api --image .../indice-api:v2 --region $REGION
```

Cada deploy cria uma revisão. Para voltar atrás sem reconstruir nada:

```bash
gcloud run revisions list --service indice-api --region $REGION
gcloud run services update-traffic indice-api --region $REGION --to-revisions REVISAO_ANTIGA=100
```

Migração de banco não volta com isso. Se a revisão nova trouxe migração
incompatível, o rollback da imagem não é suficiente.

---

## Quando algo falha

| sintoma | causa provável |
|---|---|
| `exec format error` no log | imagem construída para ARM; refaça com `--platform linux/amd64` |
| container não passa do boot, log cita permissão | falta `secretAccessor` para a service account (passo 4) |
| `401` em todas as rotas, `/health` ok | seed não rodou, ou a chave usada não é a do secret |
| `/health` retorna 500 | a API subiu mas o banco não responde: cheque `sslmode=require` e se o projeto Neon não está suspenso |
| migração trava sem terminar | está usando a URL do pooler em vez da direta |
| primeira requisição do dia demora | cold start dos dois serviços encadeados; esperado com `min-instances 0` |

Logs de um serviço:

```bash
gcloud run services logs read indice-api --region $REGION --limit 50
```

---

## Custo

Com `min-instances 0`, o free tier mensal do Cloud Run cobre uso pessoal com
folga, e o Neon gratuito não cobra. O que consome crédito de fato é o Artifact
Registry se as imagens se acumularem — cada par API+web passa de meio giga.
Pode podar de tempos em tempos:

```bash
gcloud artifacts docker images list $REGION-docker.pkg.dev/$PROJECT_ID/indice --include-tags
gcloud artifacts docker images delete $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-api:TAG_ANTIGA
```
