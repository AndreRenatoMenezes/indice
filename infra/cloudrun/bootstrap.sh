#!/usr/bin/env bash
# Prepara o projeto GCP para o deploy pelo GitHub Actions e o ambiente de QA.
# Idempotente: cada recurso é consultado antes (describe || create) e os
# vínculos de IAM são aditivos, então rodar de novo só completa o que falta.
#
# Uso:
#   infra/cloudrun/bootstrap.sh <email-acesso-web-qa> <email-usuario-app>
#
#   <email-acesso-web-qa>  conta Google que recebe roles/run.invoker em
#                          indice-web-qa (acesso pelo `gcloud run services proxy`).
#   <email-usuario-app>    e-mail do User da Produção (INDICE_USER_EMAIL do seed).
#                          Precisa ser o mesmo: o seed de QA faz upsert por e-mail
#                          e a chave de QA fica com esse usuário da cópia. Se o
#                          job indice-seed de Produção existe, o script compara
#                          com o INDICE_USER_EMAIL dele (sem a variável, vale o
#                          padrão do seed, andre@indice.local) e aborta se divergir.
#
# Os e-mails entram só como argumento; os valores dos secrets de QA são lidos da
# entrada padrão (sem eco no terminal) e nunca aparecem em argumento ou arquivo.
#
# Variáveis opcionais (padrão entre colchetes):
#   PROJECT_ID   [indice-509203]
#   REGION       [southamerica-east1]
#   AR_REPO      [indice]                  repositório de imagens da Produção
#   AR_REPO_QA   [indice-qa]               repositório de imagens de QA
#   GITHUB_REPO  [AndreRenatoMenezes/indice]
#   BUILD_SA     [<número>-compute@developer.gserviceaccount.com] conta do Cloud Build
#   RUNTIME_SA   [<número>-compute@developer.gserviceaccount.com] conta do Cloud Run
set -euo pipefail

if [[ $# -ne 2 ]]; then
  sed -n '2,25p' "$0" >&2
  exit 2
fi
INVOKER_EMAIL=$1
APP_USER_EMAIL=$2

PROJECT_ID=${PROJECT_ID:-indice-509203}
REGION=${REGION:-southamerica-east1}
AR_REPO=${AR_REPO:-indice}
AR_REPO_QA=${AR_REPO_QA:-indice-qa}
GITHUB_REPO=${GITHUB_REPO:-AndreRenatoMenezes/indice}

POOL=github
PROVIDER=github-oidc
DEPLOY_SA_NAME=gh-deployer
DEPLOY_SA="${DEPLOY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
BUILD_BUCKET="${PROJECT_ID}_cloudbuild"
BUCKET_LISTER_ROLE=indiceBucketLister

QA_DB_SECRET=indice-qa-database-url
QA_DB_DIRECT_SECRET=indice-qa-database-url-direct
QA_API_KEY_SECRET=indice-qa-api-key

log() { printf '\n==> %s\n' "$*"; }
exists() { "$@" >/dev/null 2>&1; }
g() { gcloud --project "$PROJECT_ID" --quiet "$@"; }

PROJECT_NUMBER=$(g projects describe "$PROJECT_ID" --format 'value(projectNumber)')
BUILD_SA=${BUILD_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}
RUNTIME_SA=${RUNTIME_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}
POOL_ID="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}"

log "Conferindo o e-mail do usuário do app contra o seed de Produção"
# Lê o INDICE_USER_EMAIL do job indice-seed (JSON da API, em qualquer nível).
if PROD_SEED_JSON=$(g run jobs describe indice-seed --region "$REGION" --format json 2>/dev/null); then
  PROD_USER_EMAIL=$(printf '%s' "$PROD_SEED_JSON" | python3 -I -c '
import json, sys
def find(node):
    if isinstance(node, dict):
        if node.get("name") == "INDICE_USER_EMAIL" and "value" in node:
            return node["value"]
        node = list(node.values())
    if isinstance(node, list):
        for item in node:
            found = find(item)
            if found is not None:
                return found
    return None
print(find(json.load(sys.stdin)) or "")
')
  # Sem a variável, o seed usou o padrão de packages/db/src/seed.ts.
  PROD_USER_EMAIL=${PROD_USER_EMAIL:-andre@indice.local}
  if [[ $APP_USER_EMAIL != "$PROD_USER_EMAIL" ]]; then
    echo "<email-usuario-app> difere do INDICE_USER_EMAIL do job indice-seed de Produção; abortando" >&2
    echo "(o seed de QA criaria um usuário vazio em vez de usar o da cópia)" >&2
    exit 1
  fi
  echo "confere com o seed de Produção"
else
  echo "job indice-seed de Produção não encontrado; sem conferência, confira o e-mail à mão"
fi

log "APIs"
g services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com

log "Workload Identity Federation: pool ${POOL}, provider ${PROVIDER}"
exists g iam workload-identity-pools describe "$POOL" --location global \
  || g iam workload-identity-pools create "$POOL" --location global --display-name "GitHub Actions"
# A condição recusa token de qualquer outro repositório; o mapping expõe
# attribute.environment, usado no vínculo da conta de serviço.
WIF_ISSUER="https://token.actions.githubusercontent.com"
WIF_MAPPING="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.environment=assertion.environment,attribute.ref=assertion.ref"
WIF_CONDITION="assertion.repository == '${GITHUB_REPO}'"
if PROVIDER_JSON=$(g iam workload-identity-pools providers describe "$PROVIDER" --location global \
     --workload-identity-pool "$POOL" --format json 2>/dev/null); then
  # Provider já existe: só segue se for exatamente o esperado. Não corrige
  # sozinho; um provider mais frouxo pede revisão manual.
  if ! printf '%s' "$PROVIDER_JSON" | python3 -I -c '
import json, sys
p = json.load(sys.stdin)
issuer, mapping, condition = sys.argv[1:4]
expected = dict(item.split("=", 1) for item in mapping.split(","))
problems = []
if p.get("oidc", {}).get("issuerUri") != issuer:
    problems.append("issuerUri: %r" % p.get("oidc", {}).get("issuerUri"))
if p.get("attributeMapping") != expected:
    problems.append("attributeMapping: %r" % p.get("attributeMapping"))
if p.get("attributeCondition") != condition:
    problems.append("attributeCondition: %r" % p.get("attributeCondition"))
for problem in problems:
    print("  " + problem, file=sys.stderr)
sys.exit(1 if problems else 0)
' "$WIF_ISSUER" "$WIF_MAPPING" "$WIF_CONDITION"; then
    echo "provider ${PROVIDER} já existe e diverge do esperado; abortando." >&2
    echo "esperado: issuer ${WIF_ISSUER}, mapping ${WIF_MAPPING}, condição ${WIF_CONDITION}" >&2
    echo "corrija com 'gcloud iam workload-identity-pools providers update-oidc' e rode de novo" >&2
    exit 1
  fi
  echo "provider ${PROVIDER} confere (issuer, mapping e condição)"
else
  g iam workload-identity-pools providers create-oidc "$PROVIDER" \
    --location global --workload-identity-pool "$POOL" \
    --display-name "GitHub OIDC" \
    --issuer-uri "$WIF_ISSUER" \
    --attribute-mapping "$WIF_MAPPING" \
    --attribute-condition "$WIF_CONDITION"
fi

log "Conta de serviço ${DEPLOY_SA}"
exists g iam service-accounts describe "$DEPLOY_SA" \
  || g iam service-accounts create "$DEPLOY_SA_NAME" --display-name "Deploy pelo GitHub Actions"
# Só jobs que rodam num Environment do GitHub (qa ou production) assumem a conta;
# o Environment production só aceita a branch main.
for env in qa production; do
  g iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
    --role roles/iam.workloadIdentityUser \
    --member "principalSet://iam.googleapis.com/${POOL_ID}/attribute.environment/${env}" >/dev/null
done
for role in roles/cloudbuild.builds.editor roles/logging.viewer roles/serviceusage.serviceUsageConsumer; do
  g projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:${DEPLOY_SA}" \
    --role "$role" --condition None >/dev/null
done
g iam service-accounts add-iam-policy-binding "$BUILD_SA" \
  --member "serviceAccount:${DEPLOY_SA}" --role roles/iam.serviceAccountUser >/dev/null
# Bucket onde o `gcloud builds submit` envia o código-fonte.
exists g storage buckets describe "gs://${BUILD_BUCKET}" \
  || g storage buckets create "gs://${BUILD_BUCKET}" --location US --uniform-bucket-level-access
g storage buckets add-iam-policy-binding "gs://${BUILD_BUCKET}" \
  --member "serviceAccount:${DEPLOY_SA}" --role roles/storage.admin >/dev/null
# Com o bucket padrão, o `builds submit` lista os buckets do projeto para checar que
# o bucket é deste projeto (anti name-squatting); `storage.buckets.list` só existe em
# nível de projeto. O papel dá só isso: nomes e metadados, nenhum objeto.
# Papel apagado fica ~37 dias reservado (describe responde com deleted) e volta com
# undelete; papel existente com outras permissões aborta, como o provider acima.
if lister=$(g iam roles describe "$BUCKET_LISTER_ROLE" --project "$PROJECT_ID" \
              --format 'value(deleted,includedPermissions.list())' 2>/dev/null); then
  if [[ ${lister%%$'\t'*} == [Tt]rue ]]; then
    g iam roles undelete "$BUCKET_LISTER_ROLE" --project "$PROJECT_ID" >/dev/null
    lister=$(g iam roles describe "$BUCKET_LISTER_ROLE" --project "$PROJECT_ID" \
               --format 'value(deleted,includedPermissions.list())')
  fi
  if [[ ${lister#*$'\t'} != storage.buckets.list ]]; then
    echo "papel ${BUCKET_LISTER_ROLE} já existe com permissões diferentes de storage.buckets.list; abortando." >&2
    echo "corrija com 'gcloud iam roles update ${BUCKET_LISTER_ROLE} --project ${PROJECT_ID} --permissions storage.buckets.list' e rode de novo" >&2
    exit 1
  fi
  echo "papel ${BUCKET_LISTER_ROLE} confere (só storage.buckets.list)"
else
  g iam roles create "$BUCKET_LISTER_ROLE" --project "$PROJECT_ID" \
    --title "Indice: listar buckets" --permissions storage.buckets.list --stage GA >/dev/null
fi
g projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:${DEPLOY_SA}" \
  --role "projects/${PROJECT_ID}/roles/${BUCKET_LISTER_ROLE}" --condition None >/dev/null

log "Artifact Registry: repositório ${AR_REPO_QA} e limpeza (10 versões mais recentes por imagem)"
# Repositórios separados: a limpeza por contagem de QA nunca alcança a imagem
# que serve Produção nem as de rollback.
exists g artifacts repositories describe "$AR_REPO_QA" --location "$REGION" \
  || g artifacts repositories create "$AR_REPO_QA" --repository-format docker --location "$REGION" \
       --description "Imagens do ambiente de QA"
policy=$(mktemp)
trap 'rm -f "$policy"' EXIT
cat >"$policy" <<'JSON'
[
  {"name": "apagar-antigas", "action": {"type": "Delete"}, "condition": {"tagState": "any"}},
  {"name": "manter-10-recentes", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 10}}
]
JSON
# `set-cleanup-policies` não tem `--no-dry-run` (a flag é só `--dry-run`) e,
# sem ela, mantém o modo de teste que o repositório já tiver. Se o repositório
# estiver em modo de teste, desliga pela API REST para a política valer de fato.
for repo in "$AR_REPO" "$AR_REPO_QA"; do
  g artifacts repositories set-cleanup-policies "$repo" --location "$REGION" --policy "$policy" >/dev/null
  dry_run=$(g artifacts repositories describe "$repo" --location "$REGION" --format 'value(cleanupPolicyDryRun)')
  if [[ $dry_run == [Tt]rue ]]; then
    curl -fsS -X PATCH -H 'Content-Type: application/json' \
      -H @<(printf 'Authorization: Bearer %s\n' "$(gcloud auth print-access-token)") \
      -d '{"cleanupPolicyDryRun": false}' \
      "https://artifactregistry.googleapis.com/v1/projects/${PROJECT_ID}/locations/${REGION}/repositories/${repo}?updateMask=cleanupPolicyDryRun" >/dev/null
  fi
  echo "${repo}: política aplicada, cleanupPolicyDryRun=$(g artifacts repositories describe "$repo" --location "$REGION" --format 'value(cleanupPolicyDryRun)')"
done

log "Secrets de QA"
# Cria o secret vazio e, se ainda não tem versão ativa, lê o valor da entrada
# padrão. Valor vazio na chave de API gera uma aleatória.
ensure_secret() {
  local name=$1 prompt=$2 value
  exists g secrets describe "$name" || g secrets create "$name" --replication-policy automatic
  if [[ -z $(g secrets versions list "$name" --filter 'state=ENABLED' --format 'value(name)' --limit 1) ]]; then
    printf '%s: ' "$prompt" >&2
    IFS= read -rs value || true
    printf '\n' >&2
    if [[ -z $value && $name == "$QA_API_KEY_SECRET" ]]; then
      value=$(openssl rand -base64 32 | tr -d '\n')
    fi
    if [[ -z $value ]]; then
      echo "valor vazio para ${name}; abortando" >&2
      exit 1
    fi
    printf '%s' "$value" | g secrets versions add "$name" --data-file=- >/dev/null
    unset value
  else
    echo "${name}: já tem versão ativa, mantida"
  fi
  g secrets add-iam-policy-binding "$name" --member "serviceAccount:${RUNTIME_SA}" \
    --role roles/secretmanager.secretAccessor >/dev/null
}
ensure_secret "$QA_DB_SECRET" "URL do pooler da branch Neon qa (com ?pgbouncer=true&connection_limit=1)"
ensure_secret "$QA_DB_DIRECT_SECRET" "URL direta da branch Neon qa"
ensure_secret "$QA_API_KEY_SECRET" "Chave de API de QA (vazio = gerar)"

log "Jobs indice-seed-qa e indice-rekey-qa"
# Imagem inicial: a da API de QA, ou a da Produção antes do primeiro deploy de
# QA. O qa-reset.sh atualiza os dois jobs para a imagem de QA a cada execução.
image_of() {
  g run services describe "$1" --region "$REGION" \
    --format 'value(spec.template.spec.containers[0].image)' 2>/dev/null || true
}
IMAGE=$(image_of indice-api-qa)
[[ -n $IMAGE ]] || IMAGE=$(image_of indice-api)
if [[ -z $IMAGE ]]; then
  echo "nenhuma imagem de indice-api-qa nem de indice-api; faça um deploy antes" >&2
  exit 1
fi
QA_JOB_SECRETS="DATABASE_URL=${QA_DB_DIRECT_SECRET}:latest,INDICE_API_KEY=${QA_API_KEY_SECRET}:latest"

exists g run jobs describe indice-seed-qa --region "$REGION" \
  || g run jobs create indice-seed-qa --region "$REGION" --image "$IMAGE" \
       --set-secrets "$QA_JOB_SECRETS" \
       --set-env-vars "INDICE_USER_EMAIL=${APP_USER_EMAIL}" \
       --command node --args packages/db/dist/seed.js \
       --max-retries 0

# A cópia da Produção traz o registro da chave de Produção e o seed só faz
# upsert; o rekey apaga toda ApiKey cujo hash não seja o da chave de QA.
# O hash (sha256 hex, igual a hashApiKey) é calculado no container, a partir
# do secret; a chave não passa por argumento nem pelo SQL.
# read -d '' em vez de $(cat <<…): o bash 3 do macOS não analisa `case` dentro de $(...).
IFS= read -r -d '' REKEY_SCRIPT <<'SH' || true
set -eu
h=$(node -e 'process.stdout.write(require("node:crypto").createHash("sha256").update(process.env.INDICE_API_KEY).digest("hex"))')
case "$h" in ""|*[!0-9a-f]*) echo "hash da chave de QA inválido" >&2; exit 1;; esac
printf 'DELETE FROM "ApiKey" WHERE "keyHash" <> %s;\n' "'$h'" \
  | npx prisma db execute --stdin --schema packages/db/prisma/schema.prisma
echo "rekey: só a chave de QA permanece"
SH
# `^@^` troca o separador da lista de --args (o script tem vírgulas e barras).
exists g run jobs describe indice-rekey-qa --region "$REGION" \
  || g run jobs create indice-rekey-qa --region "$REGION" --image "$IMAGE" \
       --set-secrets "$QA_JOB_SECRETS" \
       --command sh --args "^@^-c@${REKEY_SCRIPT}" \
       --max-retries 0

log "API de QA pública (protegida pela chave de QA)"
# O `run deploy --allow-unauthenticated` roda com a SA do build, que não tem
# run.services.setIamPolicy: o deploy só avisa e a API fica privada (403 antes da
# chave). Só a API recebe allUsers; a web de QA nunca.
if exists g run services describe indice-api-qa --region "$REGION"; then
  g run services add-iam-policy-binding indice-api-qa --region "$REGION" \
    --member allUsers --role roles/run.invoker >/dev/null
else
  echo "indice-api-qa ainda não existe: rode este script de novo depois do primeiro deploy de QA"
fi

log "Acesso à web de QA para ${INVOKER_EMAIL}"
if exists g run services describe indice-web-qa --region "$REGION"; then
  g run services add-iam-policy-binding indice-web-qa --region "$REGION" \
    --member "user:${INVOKER_EMAIL}" --role roles/run.invoker >/dev/null
else
  echo "indice-web-qa ainda não existe: rode este script de novo depois do primeiro deploy de QA"
fi

log "Pronto. Variables do repositório GitHub (não são segredos):"
cat <<EOF
GCP_PROJECT_ID=${PROJECT_ID}
GCP_WIF_PROVIDER=${POOL_ID}/providers/${PROVIDER}
GCP_DEPLOY_SA=${DEPLOY_SA}
EOF
