# Deploy no Google Cloud

Topologia: Cloud Run (`indice-api`, `indice-web`) + Postgres externo (Neon ou
Supabase, plano gratuito) + Artifact Registry + Secret Manager + Cloud Build.
Região sugerida: `southamerica-east1` (São Paulo).

O banco fica fora do Google porque uma instância Cloud SQL, mesmo a menor,
consome sozinha o orçamento de um projeto pessoal; Cloud Run com
`min-instances=0` e o free tier mensal custa quase nada.

## Banco (uma vez)

Crie um projeto Postgres 17 no provedor e guarde **duas** connection strings:

- **pooler** — a que a API usa em runtime. Acrescente
  `?pgbouncer=true&connection_limit=1`: o serviço escala a zero e abre conexões
  curtas, e o pooler em modo transação não suporta os statements preparados que
  o Prisma usaria com um pool próprio.
- **direta** — a que as migrações usam. `prisma migrate deploy` roda DDL e
  advisory locks, que não passam pelo pooler.

No Neon as duas aparecem no painel de conexão (com e sem `-pooler` no host). No
Supabase são as portas 6543 (pooler) e 5432 (direta).

## Preparação (uma vez)

```bash
export PROJECT_ID=seu-projeto REGION=southamerica-east1
gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudbuild.googleapis.com cloudscheduler.googleapis.com

gcloud artifacts repositories create indice --repository-format=docker --location=$REGION

# Secrets: as duas URLs do banco e a chave de API.
printf '%s' 'postgresql://...POOLER...?pgbouncer=true&connection_limit=1' \
  | gcloud secrets create indice-database-url --data-file=-
printf '%s' 'postgresql://...DIRETA...' \
  | gcloud secrets create indice-database-url-direct --data-file=-
openssl rand -base64 32 | tr -d '\n' | gcloud secrets create indice-api-key --data-file=-
```

Dê ao service account do Cloud Build e ao do Cloud Run o papel
`roles/secretmanager.secretAccessor`.

## Deploy

```bash
gcloud builds submit --config infra/cloudrun/cloudbuild.yaml \
  --substitutions _WEB_ORIGIN=https://SEU-WEB.run.app
```

O build publica as duas imagens, roda as migrações num job efêmero pela conexão
direta e faz deploy dos dois serviços.

## Seed (uma vez, após o primeiro deploy)

Obrigatório: em produção a API não aceita chave de desenvolvimento, então sem
esta etapa toda requisição responde 401. O seed cria o usuário, as categorias,
os hábitos e a meta inicial, e registra o hash da chave do Secret Manager.

```bash
TAG=$(gcloud artifacts docker tags list $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-api \
  --format 'value(tag)' --limit 1)
gcloud run jobs deploy indice-seed --image $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-api:$TAG \
  --region $REGION \
  --set-secrets DATABASE_URL=indice-database-url-direct:latest,INDICE_API_KEY=indice-api-key:latest \
  --set-env-vars INDICE_USER_EMAIL=seu@email \
  --command node --args "packages/db/dist/seed.js"
gcloud run jobs execute indice-seed --region $REGION --wait
```

A mesma chave do secret `indice-api-key` alimenta `INDICE_API_KEY_WEB` no
serviço web (o `cloudbuild.yaml` já faz isso) e o `API_KEY` do app Android.

## Snapshots diários de metas (Cloud Scheduler)

```bash
gcloud scheduler jobs create http indice-goal-snapshots --location $REGION \
  --schedule "0 3 * * *" --time-zone America/Sao_Paulo \
  --uri "$(gcloud run services describe indice-api --region $REGION --format 'value(status.url)')/goals/ID/snapshot" \
  --http-method POST --headers "X-Api-Key=CHAVE"
```
