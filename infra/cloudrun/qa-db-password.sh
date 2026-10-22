#!/usr/bin/env bash
# Dá à branch Neon `qa` uma senha de banco própria. O Neon copia para a branch
# filha os papéis com as mesmas senhas da mãe (e o `reset --parent` copia de
# novo), então sem isto a URL de QA abre a Produção trocando só o host.
#
# 1. troca a senha do papel dos secrets de QA só na branch `qa` (API do Neon);
# 2. lê os dois secrets de QA, troca só a senha na URL, em memória, e grava uma
#    versão nova de cada;
# 3. confere em memória: a versão nova é a gravada, a senha difere da de
#    Produção, o host de QA aceita a credencial e o de Produção a recusa;
# 4. só então desabilita e destrói as versões anteriores (podem ter a senha de
#    Produção); falha daqui em diante = INCOMPLETO, nunca "ok";
# 5. cria uma revisão nova de indice-api-qa, para pegar o `latest`.
#
# A senha nunca passa por argumento, stdout nem arquivo: fica em variáveis do
# shell e vai aos comandos por stdin ou pelo ambiente. Imprime só ok/falhou.
# Entre a troca da senha e a gravação dos secrets, QA fica sem conectar (nunca o
# contrário); rodar de novo é seguro.
#
# Uso (da raiz do repositório, com `npm ci` feito: a conferência de conexão usa o
# @prisma/client do repo):
#   NEON_API_KEY=... NEON_PROJECT_ID=... infra/cloudrun/qa-db-password.sh
# O qa-reset.sh chama este script logo depois do reset da branch.
#
# Variáveis opcionais (padrão entre colchetes):
#   PROJECT_ID   [indice-509203]
#   REGION       [southamerica-east1]
#   NEON_ROLE    [neondb_owner]
set -euo pipefail

: "${NEON_API_KEY:?defina NEON_API_KEY no ambiente}"
: "${NEON_PROJECT_ID:?defina NEON_PROJECT_ID no ambiente}"
PROJECT_ID=${PROJECT_ID:-indice-509203}
REGION=${REGION:-southamerica-east1}
NEON_ROLE=${NEON_ROLE:-neondb_owner}
NEON_BRANCH=qa
SECRETS=(indice-qa-database-url indice-qa-database-url-direct)
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PRISMA_CLIENT="$ROOT/node_modules/@prisma/client"

g() { gcloud --project "$PROJECT_ID" --quiet "$@"; }
falhou() { echo "falhou: $*" >&2; exit 1; }

command -v neonctl >/dev/null || falhou "neonctl não encontrado"
[[ -d $PRISMA_CLIENT ]] || falhou "@prisma/client ausente em node_modules (rode npm ci na raiz)"

# Partes da URL, sem imprimir: usuario, senha, host.
url_parte() {  # $1 = user|pass|host; URL em $2
  local u=${2#*://} cred
  cred=${u%%@*}
  case $1 in
    user) printf '%s' "${cred%%:*}" ;;
    pass) printf '%s' "${cred#*:}" ;;
    host) u=${u#*@}; u=${u%%/*}; printf '%s' "${u%%:*}" ;;
  esac
}
# Mesma URL com a senha trocada (Neon gera senhas alfanuméricas: sem escape).
com_senha() {  # $1 = URL, $2 = senha
  local esquema=${1%%://*} resto=${1#*://}
  printf '%s://%s:%s@%s' "$esquema" "$(url_parte user "$1")" "$2" "${resto#*@}"
}
# Conecta e roda SELECT 1 com a URL do ambiente; imprime só ok, auth ou erro.
conecta() {  # URL em $1, passada pelo ambiente
  DATABASE_URL=$1 node -e '
    const { PrismaClient } = require(process.argv[1]);
    const db = new PrismaClient();
    db.$queryRawUnsafe("SELECT 1").then(() => console.log("ok"))
      .catch(e => console.log(e.errorCode === "P1000" || /authentication failed/i.test(e.message) ? "auth" : "erro"))
      .finally(() => db.$disconnect());' "$PRISMA_CLIENT" 2>/dev/null || echo erro
}

# Branch qa: precisa existir, ter mãe e não ser a padrão (a principal).
BRANCH_ID=$(neonctl branches list --project-id "$NEON_PROJECT_ID" --output json </dev/null | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
d = d.get("branches", d) if isinstance(d, dict) else d
b = [x for x in d if x.get("name") == sys.argv[1]]
ok = len(b) == 1 and b[0].get("parent_id") and not b[0].get("default")
print(b[0]["id"] if ok else "")
' "$NEON_BRANCH")
[[ -n $BRANCH_ID ]] || falhou "branch ${NEON_BRANCH} não encontrada, sem mãe ou marcada como padrão"

# Estado atual dos secrets (versões a destruir depois e URLs de QA). Arrays
# indexados em paralelo a SECRETS (bash 3.2 do macOS não tem arrays associativos).
ANTIGAS=(); URL=()
for i in "${!SECRETS[@]}"; do
  s=${SECRETS[$i]}
  ANTIGAS[$i]=$(g secrets versions list "$s" --filter='state!=DESTROYED' --format='value(name.basename())' | tr '\n' ' ')
  URL[$i]=$(g secrets versions access latest --secret "$s")
  [[ $(url_parte host "${URL[$i]}") == *.neon.tech && -n $(url_parte user "${URL[$i]}") ]] \
    || falhou "secret $s fora do formato esperado"
done
PROD_URL=$(neonctl cs production --project-id "$NEON_PROJECT_ID" </dev/null)
PROD_HOST=$(url_parte host "$PROD_URL")
PROD_PASS=$(url_parte pass "$PROD_URL")
unset PROD_URL
[[ -n $PROD_HOST && -n $PROD_PASS ]] || falhou "não consegui ler a URL de Produção"

# 1. senha nova, só na branch qa. A resposta da API vai direto para a variável.
NOVA=$(neonctl api "/projects/${NEON_PROJECT_ID}/branches/${BRANCH_ID}/roles/${NEON_ROLE}/reset_password" \
         -X POST </dev/null 2>/dev/null | python3 -I -c '
import json, sys
print(json.load(sys.stdin).get("role", {}).get("password") or "")')
[[ $NOVA =~ ^[A-Za-z0-9_]+$ ]] || falhou "reset_password não devolveu uma senha válida"
echo "senha da branch ${NEON_BRANCH} trocada: ok"

# 2. versão nova de cada secret, por stdin.
NOVA_URL=(); NOVA_VERSAO=()
for i in "${!SECRETS[@]}"; do
  s=${SECRETS[$i]}
  NOVA_URL[$i]=$(com_senha "${URL[$i]}" "$NOVA")
  NOVA_VERSAO[$i]=$(printf '%s' "${NOVA_URL[$i]}" \
    | g secrets versions add "$s" --data-file=- --format='value(name.basename())') \
    || falhou "secret $s: versão nova não gravada; a branch já tem a senha nova: rode este script de novo"
  [[ -n ${NOVA_VERSAO[$i]} ]] || falhou "secret $s: versão nova não gravada; rode este script de novo"
  echo "secret $s: versão ${NOVA_VERSAO[$i]} gravada: ok"
done

# 3. conferências (em memória; só ok/falhou).
for i in "${!SECRETS[@]}"; do
  [[ $(g secrets versions access latest --secret "${SECRETS[$i]}") == "${NOVA_URL[$i]}" ]] \
    || falhou "secret ${SECRETS[$i]}: latest diferente do gravado"
done
echo "secrets relidos iguais ao gravado: ok"
[[ $NOVA != "$PROD_PASS" ]] || falhou "senha nova igual à de Produção"
echo "senha de QA diferente da de Produção: ok"
DIRETA=${NOVA_URL[1]}   # SECRETS[1] = indice-qa-database-url-direct
[[ $(conecta "$DIRETA") == ok ]] || falhou "credencial nova não conecta no host de QA"
echo "host de QA aceita a credencial nova: ok"
NA_PROD=$(conecta "${DIRETA/@$(url_parte host "$DIRETA")/@$PROD_HOST}")
[[ $NA_PROD == auth ]] || falhou "host de Produção não recusou a credencial de QA por autenticação (resultado: $NA_PROD)"
echo "host de Produção recusa a credencial de QA: ok"
unset PROD_PASS DIRETA

# Daqui em diante a senha nova já vale e está conferida. Qualquer falha é
# INCOMPLETO (nunca "ok"); rodar de novo é seguro: troca a senha outra vez e trata
# como antiga toda versão não destruída, inclusive as já desabilitadas.
incompleto() { echo "INCOMPLETO: $*; rode este script de novo" >&2; exit 1; }
estado_versao() {  # $1 = versão, $2 = secret
  g secrets versions describe "$1" --secret "$2" --format='value(state)'
}

# 4. desabilita as versões anteriores (deixam de ser lidas) e só então as destrói.
for i in "${!SECRETS[@]}"; do
  s=${SECRETS[$i]}
  for v in ${ANTIGAS[$i]}; do
    [[ $v == "${NOVA_VERSAO[$i]}" ]] && continue
    est=$(estado_versao "$v" "$s") || incompleto "secret $s: não consegui ler o estado da versão $v"
    if [[ $est == ENABLED ]]; then
      g secrets versions disable "$v" --secret "$s" >/dev/null \
        || incompleto "secret $s: não consegui desabilitar a versão $v (ainda ENABLED)"
    fi
  done
  echo "secret $s: versões anteriores desabilitadas: ok"
done
for i in "${!SECRETS[@]}"; do
  s=${SECRETS[$i]}
  for v in ${ANTIGAS[$i]}; do
    [[ $v == "${NOVA_VERSAO[$i]}" ]] && continue
    for tentativa in 1 2 3; do
      est=$(estado_versao "$v" "$s") || est=?
      [[ $est == DESTROYED ]] && break
      g secrets versions destroy "$v" --secret "$s" >/dev/null 2>&1 || true
    done
    est=$(estado_versao "$v" "$s") || est=?
    [[ $est == DESTROYED ]] \
      || incompleto "secret $s: versão $v não foi destruída após 3 tentativas (estado: $est)"
  done
  restantes=$(g secrets versions list "$s" --filter='state!=DESTROYED' --format='value(name.basename())' | tr '\n' ' ') \
    || incompleto "secret $s: não consegui listar as versões"
  [[ $restantes == "${NOVA_VERSAO[$i]} " ]] \
    || incompleto "secret $s: sobrou versão não destruída além da nova (${restantes})"
  echo "secret $s: anteriores DESTROYED, só a versão ${NOVA_VERSAO[$i]} ativa: ok"
done
unset NOVA NOVA_URL URL

# 5. revisão nova de indice-api-qa para pegar o latest (os jobs leem a cada execução).
g run services update indice-api-qa --region "$REGION" \
  --update-labels "qa-db-password=$(date -u +%Y%m%d%H%M%S)" >/dev/null \
  || incompleto "revisão nova de indice-api-qa não foi criada (secrets já certos)"
echo "revisão nova de indice-api-qa: ok"
echo "qa-db-password: ok"
