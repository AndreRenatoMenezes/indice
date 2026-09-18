# Deploy no Google Cloud

Topologia: Cloud Run (`indice-api`, `indice-web`) + Cloud SQL (PostgreSQL 17)
+ Artifact Registry + Secret Manager + Cloud Build. Região sugerida:
`southamerica-east1` (São Paulo).

## Preparação (uma vez)

```bash
export PROJECT_ID=seu-projeto REGION=southamerica-east1
gcloud config set project $PROJECT_ID
gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com cloudbuild.googleapis.com cloudscheduler.googleapis.com

gcloud artifacts repositories create indice --repository-format=docker --location=$REGION

# Cloud SQL (menor tier para uso pessoal)
gcloud sql instances create indice-db --database-version=POSTGRES_17 --tier=db-f1-micro --region=$REGION
gcloud sql databases create indice --instance=indice-db
gcloud sql users create indice --instance=indice-db --password='TROQUE'

# Secrets
CONN=$(gcloud sql instances describe indice-db --format 'value(connectionName)')
printf "postgresql://indice:TROQUE@localhost/indice?host=/cloudsql/%s&schema=public" "$CONN" \
  | gcloud secrets create indice-database-url --data-file=-
openssl rand -base64 32 | tr -d '\n' | gcloud secrets create indice-api-key --data-file=-
```

Dê ao service account do Cloud Build/Cloud Run os papéis `roles/cloudsql.client`
e `roles/secretmanager.secretAccessor`.

## Deploy

```bash
gcloud builds submit --config infra/cloudrun/cloudbuild.yaml \
  --substitutions _SQL_INSTANCE=$CONN,_WEB_ORIGIN=https://SEU-WEB.run.app
```

Depois do primeiro deploy, rode o seed uma vez (cria usuário, categorias,
hábitos, meta e registra a chave do Secret Manager):

```bash
gcloud run jobs deploy indice-seed --image $REGION-docker.pkg.dev/$PROJECT_ID/indice/indice-api:TAG \
  --region $REGION --set-cloudsql-instances $CONN \
  --set-secrets DATABASE_URL=indice-database-url:latest,INDICE_API_KEY=indice-api-key:latest \
  --set-env-vars INDICE_USER_EMAIL=seu@email \
  --command npx --args "tsx,packages/db/prisma/seed.ts"
gcloud run jobs execute indice-seed --region $REGION --wait
```

## Snapshots diários de metas (Cloud Scheduler)

```bash
gcloud scheduler jobs create http indice-goal-snapshots --location $REGION \
  --schedule "0 3 * * *" --time-zone America/Sao_Paulo \
  --uri "$(gcloud run services describe indice-api --region $REGION --format 'value(status.url)')/goals/ID/snapshot" \
  --http-method POST --headers "X-Api-Key=CHAVE"
```
