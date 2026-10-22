#!/usr/bin/env bash
# Recopia a Produção para QA: reseta a branch Neon `qa` a partir da principal
# (dados de hoje), dá à `qa` uma senha de banco própria (qa-db-password.sh: o
# reset copia as senhas da mãe), reaplica as migrações de QA, roda o seed e o
# rekey, que deixa só a chave de QA válida. É o único jeito suportado de resetar QA: um reset
# pelo painel do Neon, sem o rekey, deixa a chave de Produção abrindo QA.
#
# Uso:
#   export NEON_API_KEY=...      # só no terminal local; nunca no repo nem no GitHub
#   export NEON_PROJECT_ID=...
#   infra/cloudrun/qa-reset.sh
#
# Requer `gcloud` autenticado, `neonctl` (npm i -g neonctl, lê NEON_API_KEY do
# ambiente), `curl`, `node` e `npm ci` feito na raiz (qa-db-password.sh usa o
# @prisma/client do repo para conferir a credencial). Pré-requisitos criados pelo primeiro deploy de QA
# (indice-api-qa, indice-migrate-qa) e pelo bootstrap.sh (indice-seed-qa,
# indice-rekey-qa).
#
# A branch Neon é sempre `qa`: o script só reseta QA e recusa NEON_BRANCH
# com qualquer outro valor.
#
# Variáveis opcionais (padrão entre colchetes):
#   PROJECT_ID   [indice-509203]
#   REGION       [southamerica-east1]
set -euo pipefail

: "${NEON_API_KEY:?defina NEON_API_KEY no ambiente}"
: "${NEON_PROJECT_ID:?defina NEON_PROJECT_ID no ambiente}"
PROJECT_ID=${PROJECT_ID:-indice-509203}
REGION=${REGION:-southamerica-east1}
if [[ ${NEON_BRANCH:-qa} != qa ]]; then
  echo "NEON_BRANCH=${NEON_BRANCH}: este script só reseta a branch qa; abortando" >&2
  exit 1
fi
NEON_BRANCH=qa

log() { printf '\n==> %s\n' "$*"; }
g() { gcloud --project "$PROJECT_ID" --quiet "$@"; }

command -v neonctl >/dev/null || { echo "neonctl não encontrado (npm i -g neonctl)" >&2; exit 1; }

log "Conferindo pré-requisitos"
IMAGE=$(g run services describe indice-api-qa --region "$REGION" \
  --format 'value(spec.template.spec.containers[0].image)')
for job in indice-migrate-qa indice-seed-qa indice-rekey-qa; do
  g run jobs describe "$job" --region "$REGION" >/dev/null
done
echo "imagem de QA: ${IMAGE}"

printf 'Isto apaga os dados da branch Neon "%s" e copia os da Produção. Digite %s para continuar: ' \
  "$NEON_BRANCH" "$NEON_BRANCH" >&2
read -r answer
[[ $answer == "$NEON_BRANCH" ]] || { echo "cancelado" >&2; exit 1; }

log "Reset da branch Neon ${NEON_BRANCH} a partir da principal"
neonctl branches reset "$NEON_BRANCH" --parent --project-id "$NEON_PROJECT_ID"

# O reset copiou de novo as senhas da principal para a `qa`: troca a senha só na
# `qa` e grava os secrets de QA antes de qualquer job conectar.
log "Senha de banco própria de QA"
"$(dirname "$0")/qa-db-password.sh"

log "Jobs de seed e rekey na imagem atual de QA"
g run jobs update indice-seed-qa --region "$REGION" --image "$IMAGE" >/dev/null
g run jobs update indice-rekey-qa --region "$REGION" --image "$IMAGE" >/dev/null

# Ordem importa: migrações de development antes do seed (schema atual), rekey
# por último (depois de o seed registrar a chave de QA).
for job in indice-migrate-qa indice-seed-qa indice-rekey-qa; do
  log "Executando ${job}"
  g run jobs execute "$job" --region "$REGION" --wait
done

log "Saúde da API de QA"
API_URL=$(g run services describe indice-api-qa --region "$REGION" --format 'value(status.url)')
curl -fsS "${API_URL}/health" && echo

log "QA recopiada. Confira: /habits/today com a chave de QA → 200, com a de Produção → 401."
