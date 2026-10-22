#!/usr/bin/env bash
# Troca a senha do papel do banco de Produção (`neondb_owner` na branch Neon
# `production`) e regrava os secrets de Produção. Feito para a rotação depois do
# vazamento registrado em decisoes.md (2026-10-22); roteiro e GATES em
# .claude/specs/current/002-infra-ambientes/rotacao-senha-producao.md.
#
# 0. só leitura: a branch production é a padrão e a única além da qa; os dois
#    secrets são lidos exatamente por indice-api (pooler), indice-migrate e
#    indice-seed (direta), todos em `latest`; os secrets batem com a senha
#    atual do Neon, a credencial atual conecta e o /health está 200 (se os
#    secrets estão atrás do Neon, é recuperação de uma rodada que parou entre 1
#    e 2: segue sem essas duas conferências);
# 1. troca a senha só na branch production (API do Neon);
# 2. grava uma versão nova de cada secret, trocando só a senha na URL, em memória;
# 3. confere em memória: latest = gravado; pooler e direta conectam com a senha
#    nova; a senha antiga é recusada por autenticação (P1000);
# 4. cria uma revisão nova de indice-api (instâncias quentes ainda têm a senha
#    antiga) e confere que ela está pronta, com 100% do tráfego e /health 200;
# 5. só então desabilita e destrói as versões anteriores; confere de novo o
#    /health e que QA continua conectando com a senha própria.
#
# A senha nunca passa por argumento, stdout nem arquivo: fica em variáveis do
# shell e vai aos comandos por stdin ou pelo ambiente. Saída: linhas "ok";
# "falhou: ..." só antes da primeira escrita (nada mudou); depois dela, qualquer
# falha imprime "INCOMPLETO: ...; rode este script de novo" em stderr e sai != 0.
# Janela sem conexão: entre o passo 1 e o 2 (segundos) nenhuma conexão nova abre;
# depois disso instância nova, de qualquer revisão, já lê a senha nova. Rodar de
# novo é seguro: troca a senha outra vez e trata como antiga toda versão não
# destruída.
#
# Uso (da raiz do repositório, com `npm ci` feito: a conferência de conexão usa o
# @prisma/client do repo):
#   NEON_API_KEY=... NEON_PROJECT_ID=... infra/cloudrun/prod-db-password.sh
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
NEON_BRANCH=production
SECRETS=(indice-database-url indice-database-url-direct)
QA_DIRECT_SECRET=indice-qa-database-url-direct
SERVICE=indice-api
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PRISMA_CLIENT="$ROOT/node_modules/@prisma/client"

g() { gcloud --project "$PROJECT_ID" --quiet "$@"; }
# Antes da primeira escrita (reset_password), falha = "falhou:" e nada mudou.
# Depois dela, toda saída != 0, inclusive crua por set -e ou Ctrl-C, é INCOMPLETO.
ESCREVEU=0
incompleto() { echo "INCOMPLETO: $*; rode este script de novo" >&2; trap - EXIT; exit 1; }
falhou() { (( ESCREVEU )) && incompleto "$*"; echo "falhou: $*" >&2; exit 1; }
ao_sair() {
  local rc=$?
  (( rc != 0 && ESCREVEU )) && echo "INCOMPLETO: saída inesperada (código $rc); rode este script de novo" >&2
  exit "$rc"
}
trap ao_sair EXIT
# Sinal sem trap mata o bash sem passar pelo EXIT; assim passa.
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM

command -v neonctl >/dev/null || falhou "neonctl não encontrado"
command -v curl >/dev/null || falhou "curl não encontrado"
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
# Código HTTP do /health de indice-api (o handler roda SELECT 1 no banco).
health() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$(g run services describe "$SERVICE" \
    --region "$REGION" --format='value(status.url)')/health" || echo 000
}

# 0. Pré-condições, só leitura.

# Branches: production é a padrão e a única outra é a qa. Branch filha criada
# antes da troca herda a senha vazada e continuaria aceitando-a.
BRANCH_ID=$(neonctl branches list --project-id "$NEON_PROJECT_ID" --output json </dev/null | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
d = d.get("branches", d) if isinstance(d, dict) else d
nomes = sorted(x.get("name") for x in d)
b = [x for x in d if x.get("name") == sys.argv[1]]
ok = len(b) == 1 and b[0].get("default") and nomes == sorted([sys.argv[1], "qa"])
print(b[0]["id"] if ok else "")
' "$NEON_BRANCH")
[[ -n $BRANCH_ID ]] || falhou "branch ${NEON_BRANCH} não é a padrão, ou há branches além de ${NEON_BRANCH} e qa (veja o roteiro, GATE 1)"
echo "branches: ${NEON_BRANCH} (padrão) e qa: ok"

# Consumidores: quem referencia os dois secrets na região tem de ser exatamente
# este mapeamento, em `latest`. Consumidor a mais ou a menos, outro secret ou
# versão fixa (que continuaria lendo a senha antiga) aborta antes de escrever.
ESPERADO="jobs/indice-migrate=indice-database-url-direct:latest jobs/indice-seed=indice-database-url-direct:latest services/indice-api=indice-database-url:latest"
CONSUMIDORES=""
for tipo in services jobs; do
  nomes=$(g run "$tipo" list --region "$REGION" --format='value(metadata.name)') \
    || falhou "não consegui listar os $tipo"
  for nome in $nomes; do
    refs=$(g run "$tipo" describe "$nome" --region "$REGION" --format=json | python3 -I -c '
import json, sys
alvo = set(sys.argv[1:])
out = set()
def anda(n):
    if isinstance(n, dict):
        r = n.get("secretKeyRef")
        if isinstance(r, dict) and r.get("name") in alvo:
            out.add("%s:%s" % (r["name"], r.get("key", "")))
        for v in n.values(): anda(v)
    elif isinstance(n, list):
        for v in n: anda(v)
anda(json.load(sys.stdin))
print(" ".join(sorted(out)))
' "${SECRETS[@]}") || falhou "não consegui ler $tipo/$nome"
    for r in $refs; do CONSUMIDORES="$CONSUMIDORES $tipo/$nome=$r"; done
  done
done
CONSUMIDORES=$(printf '%s\n' $CONSUMIDORES | LC_ALL=C sort | xargs)
[[ $CONSUMIDORES == "$ESPERADO" ]] \
  || falhou "consumidores diferentes do esperado (veja o roteiro, GATE 3): achado [${CONSUMIDORES}], esperado [${ESPERADO}]"
echo "consumidores exatamente ${ESPERADO}: ok"

# Estado atual dos secrets (versões a destruir depois e URLs).
ANTIGAS=(); URL=()
for i in "${!SECRETS[@]}"; do
  s=${SECRETS[$i]}
  ANTIGAS[$i]=$(g secrets versions list "$s" --filter='state!=DESTROYED' --format='value(name.basename())' | tr '\n' ' ')
  URL[$i]=$(g secrets versions access latest --secret "$s")
  [[ $(url_parte host "${URL[$i]}") == *.neon.tech && $(url_parte user "${URL[$i]}") == "$NEON_ROLE" ]] \
    || falhou "secret $s fora do formato esperado (host Neon, usuário ${NEON_ROLE})"
done
NEON_URL=$(neonctl cs "$NEON_BRANCH" --project-id "$NEON_PROJECT_ID" --role-name "$NEON_ROLE" </dev/null)
DIRETA=${URL[1]}   # SECRETS[1] = indice-database-url-direct
[[ $(url_parte host "$NEON_URL") == "$(url_parte host "$DIRETA")" ]] \
  || falhou "host do secret direto difere do host da branch ${NEON_BRANCH}"
# ANTIGA = senha que os secrets guardam (a vazada, numa primeira rodada); é ela
# que tem de ser recusada no passo 3.
ANTIGA=$(url_parte pass "$DIRETA")
[[ $(url_parte pass "${URL[0]}") == "$ANTIGA" ]] || falhou "os dois secrets guardam senhas diferentes"
if [[ $(url_parte pass "$NEON_URL") == "$ANTIGA" ]]; then
  echo "secrets iguais à senha atual da branch ${NEON_BRANCH}: ok"
  [[ $(conecta "$DIRETA") == ok ]] || falhou "a credencial atual não conecta; estado inesperado, nada foi trocado"
  echo "credencial atual conecta (antes da troca): ok"
  [[ $(health) == 200 ]] || falhou "/health de ${SERVICE} não está 200 antes da troca; nada foi trocado"
  echo "/health de ${SERVICE} antes da troca: ok"
else
  # Rodada anterior parou entre o passo 1 e o 2: o Neon já tem senha nova que
  # nenhum secret guarda e Produção não conecta. Seguir troca de novo e regrava.
  echo "RECUPERAÇÃO: secrets atrás da senha do Neon (rodada anterior parou entre os passos 1 e 2); seguindo"
fi
unset NEON_URL

# 1. senha nova, só na branch production. A resposta da API vai direto para a
# variável. A partir daqui nenhuma conexão nova abre até o passo 2, e toda falha
# é INCOMPLETO (a senha pode ter mudado mesmo com erro na resposta).
ESCREVEU=1
NOVA=$(neonctl api "/projects/${NEON_PROJECT_ID}/branches/${BRANCH_ID}/roles/${NEON_ROLE}/reset_password" \
         -X POST </dev/null 2>/dev/null | python3 -I -c '
import json, sys
print(json.load(sys.stdin).get("role", {}).get("password") or "")') \
  || incompleto "reset_password falhou; se a senha mudou mesmo assim, Produção está sem conectar: rode já"
[[ $NOVA =~ ^[A-Za-z0-9_]+$ ]] \
  || incompleto "reset_password não devolveu uma senha válida; se a senha mudou mesmo assim, Produção está sem conectar: rode já"
echo "senha da branch ${NEON_BRANCH} trocada: ok"

# 2. versão nova de cada secret, por stdin.
NOVA_URL=(); NOVA_VERSAO=()
for i in "${!SECRETS[@]}"; do
  s=${SECRETS[$i]}
  NOVA_URL[$i]=$(com_senha "${URL[$i]}" "$NOVA")
  NOVA_VERSAO[$i]=$(printf '%s' "${NOVA_URL[$i]}" \
    | g secrets versions add "$s" --data-file=- --format='value(name.basename())') \
    || incompleto "secret $s: versão nova não gravada e a branch já tem a senha nova (Produção sem conectar): rode já"
  [[ -n ${NOVA_VERSAO[$i]} ]] || incompleto "secret $s: versão nova não gravada (Produção sem conectar): rode já"
  echo "secret $s: versão ${NOVA_VERSAO[$i]} gravada: ok"
done

# Daqui em diante a senha nova vale e está nos secrets; rodar de novo é seguro.

# 3. conferências (em memória; só ok/falhou).
for i in "${!SECRETS[@]}"; do
  [[ $(g secrets versions access latest --secret "${SECRETS[$i]}") == "${NOVA_URL[$i]}" ]] \
    || incompleto "secret ${SECRETS[$i]}: latest diferente do gravado"
  [[ $(conecta "${NOVA_URL[$i]}") == ok ]] || incompleto "secret ${SECRETS[$i]}: a credencial nova não conecta"
done
echo "secrets relidos iguais ao gravado e credencial nova conecta (pooler e direta): ok"
[[ $NOVA != "$ANTIGA" ]] || incompleto "senha nova igual à antiga"
NA_ANTIGA=$(conecta "$DIRETA")
[[ $NA_ANTIGA == auth ]] || incompleto "a senha antiga não foi recusada por autenticação (resultado: $NA_ANTIGA)"
echo "senha antiga recusada (P1000): ok"
unset DIRETA

# 4. revisão nova de indice-api: instâncias quentes ainda têm a senha antiga no
# ambiente. Os jobs (migrate, seed) leem o latest a cada execução.
g run services update "$SERVICE" --region "$REGION" \
  --update-labels "prod-db-password=$(date -u +%Y%m%d%H%M%S)" >/dev/null \
  || incompleto "revisão nova de ${SERVICE} não ficou pronta (secrets já certos; veja o plano de volta)"
g run services describe "$SERVICE" --region "$REGION" --format=json | python3 -I -c '
import json, sys
st = json.load(sys.stdin)["status"]
rev = st.get("latestCreatedRevisionName")
ok = rev and rev == st.get("latestReadyRevisionName") and any(
    t.get("revisionName") == rev and t.get("percent") == 100 for t in st.get("traffic", []))
sys.exit(0 if ok else 1)' || incompleto "revisão nova de ${SERVICE} não está pronta com 100% do tráfego"
[[ $(health) == 200 ]] || incompleto "/health de ${SERVICE} não respondeu 200 na revisão nova"
echo "revisão nova de ${SERVICE} pronta, 100% do tráfego, /health 200: ok"

# 5. desabilita as versões anteriores (deixam de ser lidas) e só então as destrói.
# Elas guardam só a senha já recusada: não servem de volta.
estado_versao() {  # $1 = versão, $2 = secret
  g secrets versions describe "$1" --secret "$2" --format='value(state)'
}
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
unset NOVA_URL URL ANTIGA

[[ $(health) == 200 ]] || incompleto "/health de ${SERVICE} deixou de responder 200 depois de destruir as versões"
echo "/health de ${SERVICE} depois da limpeza: ok"

# QA tem senha própria (qa-db-password.sh) e não pode ter sido afetada.
QA_URL=$(g secrets versions access latest --secret "$QA_DIRECT_SECRET") \
  || incompleto "não consegui ler ${QA_DIRECT_SECRET} para conferir QA"
[[ $(url_parte pass "$QA_URL") != "$NOVA" ]] || incompleto "QA tem a mesma senha nova de Produção"
[[ $(conecta "$QA_URL") == ok ]] || incompleto "QA não conecta com a própria credencial"
unset QA_URL NOVA
echo "QA segue com senha própria e conectando: ok"
echo "prod-db-password: ok"
