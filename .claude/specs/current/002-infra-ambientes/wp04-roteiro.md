# WP04 — Roteiro de provisionamento (execução manual pelo usuário)

Checklist para o Andre rodar à mão, na ordem. Base: `plan.md` (WP04), `spec.md`,
`decisoes.md`, `infra/cloudrun/README.md`, `bootstrap.sh`, `qa-reset.sh`.
Nenhum agente roda estes comandos; a lane da WP04 continua com o usuário.

Marcas:
- **[ALERTA PRODUÇÃO]** — mexe em recurso que a Produção usa.
- **[CUSTO]** — cria recurso que pode cobrar.
- **[ESPERA]** — depende de algo fora deste roteiro.
- **[GATE]** — verificação binária: só siga se imprimir `ok`.

## Convenções (valem para todos os passos)

- Shell: **zsh**, na raiz do repositório (`cd ~/Documents/GitHub/indice`).
- **Segredo nunca em argumento nem em tela.** Valor sensível entra por prompt sem eco
  (`read -rs`) ou vai de um comando para outro por pipe (stdin). Nada de
  `export X=valor`, nada de `echo` de segredo, nada de segredo em argumento de
  processo. `printf` e `read` usados aqui são *builtins* do zsh (não viram processo).
- **Provas ficam fora do repositório** (ele é público): `$PROVAS` abaixo. Não guarde
  nelas URL de banco, chave de API nem token. Os e-mails aparecem em algumas saídas:
  tudo bem na pasta local, nunca em commit.
- **O ambiente local não é alterado de forma permanente:** o projeto do `gcloud` vai
  por variável de ambiente desta sessão (`CLOUDSDK_CORE_PROJECT`), não por
  `gcloud config set`; o que for instalado é registrado e desfeito no Passo 15.
- Variáveis e funções desta sessão (cole uma vez; nenhuma é segredo):

```zsh
export PROJECT_ID=indice-509203 REGION=southamerica-east1
export CLOUDSDK_CORE_PROJECT=$PROJECT_ID   # só nesta sessão; não mexe na config do gcloud
PROVAS=~/indice-wp04-provas; mkdir -p "$PROVAS"
GH_REPO=AndreRenatoMenezes/indice

# Política de limpeza esperada num describe salvo em JSON: as duas regras do
# bootstrap e dry-run desligado. Sai 0 se confere, 1 se não.
politica_ok() {
  python3 -I -c '
import json, sys
d = json.load(open(sys.argv[1]))
p = d.get("cleanupPolicies") or {}
keep = p.get("manter-10-recentes", {}).get("mostRecentVersions", {})
ok = (set(p) == {"apagar-antigas", "manter-10-recentes"}
      and int(keep.get("keepCount", 0)) == 10
      and not d.get("cleanupPolicyDryRun", False))
sys.exit(0 if ok else 1)
' "$1"
}

# Host direto do compute read_write de uma branch Neon (pelo nome). Só metadados:
# não lê senha nem connection string.
neon_branch_id() {
  neonctl branches list --project-id "$NEON_PROJECT_ID" --output json | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
d = d.get("branches", d) if isinstance(d, dict) else d
print(next((b["id"] for b in d if b.get("name") == sys.argv[1]), ""))
' "$1"
}
neon_host() {
  local id; id=$(neon_branch_id "$1"); [[ -n $id ]] || return 1
  neonctl endpoints list --project-id "$NEON_PROJECT_ID" --output json | python3 -I -c '
import json, sys
d = json.load(sys.stdin)
d = d.get("endpoints", d) if isinstance(d, dict) else d
print(next((e["host"] for e in d if e.get("branch_id") == sys.argv[1] and e.get("type") == "read_write"), ""))
' "$id"
}
```

---

## Passo 1 — Ferramentas e conta

- **Objetivo:** confirmar `gcloud`, `neonctl`, `gh`, a conta ativa e que ela é dona do
  projeto, registrando o estado local para restaurar no fim.
- **Comando:**

```zsh
{ print "projeto_gcloud_anterior=$(gcloud config get project 2>/dev/null)"
  print "neonctl_preexistente=$(command -v neonctl >/dev/null && print sim || print nao)"
} | tee "$PROVAS/01-estado-local.txt"
gcloud version | head -1 | tee "$PROVAS/01-versoes.txt"
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud projects get-iam-policy "$PROJECT_ID" --flatten=bindings \
  --filter="bindings.members:user:$(gcloud config get account)" --format='value(bindings.role)'
command -v neonctl >/dev/null || npm i -g neonctl
neonctl --version | tee -a "$PROVAS/01-versoes.txt"
read -rs 'NEON_API_KEY?Chave da API do Neon: ' && export NEON_API_KEY && print
neonctl me --output json >/dev/null && print "neonctl autenticado"
gh auth status
```

- **Saída esperada:** conta ativa = a sua; a lista de papéis inclui `roles/owner`;
  "neonctl autenticado"; `gh` logado com acesso ao repositório.
- **Prova:** `01-estado-local.txt` (projeto anterior do `gcloud`, se o `neonctl` já
  existia) e `01-versoes.txt`.
- **Desfazer:** a config do `gcloud` não foi alterada (o projeto vai por
  `CLOUDSDK_CORE_PROJECT`, que some ao fechar o terminal). O `neonctl` instalado aqui
  é removido no Passo 15 se `neonctl_preexistente=nao`. A chave do Neon some com
  `unset NEON_API_KEY` (Passo 15).
- **Risco:** a chave do Neon dá controle total do projeto Neon; ela existe só nesta
  sessão. `npm i -g` instala globalmente (fica registrado para desfazer).

## Passo 2 — Projeto e faturamento

- **Objetivo:** projeto certo e faturamento ativo (Cloud Build e Artifact Registry exigem).
- **Comando:**

```zsh
{ gcloud projects describe "$PROJECT_ID" --format='value(projectId,projectNumber,lifecycleState)'
  gcloud billing projects describe "$PROJECT_ID" --format='value(billingEnabled)'
  gcloud run services list --region "$REGION" --format='value(metadata.name)'
  gcloud run jobs list --region "$REGION" --format='value(metadata.name)'
} | tee "$PROVAS/02-projeto.txt"
```

- **Saída esperada:** `indice-509203 <número> ACTIVE`; `True`; serviços `indice-api`,
  `indice-web`; jobs `indice-migrate`, `indice-seed`. Nenhum `*-qa` ainda.
- **Prova:** `02-projeto.txt`.
- **Desfazer:** nada.
- **Risco:** se já existir algo `*-qa`, pare e avise o Luke antes de seguir.

## Passo 3 — Quem é o usuário do app em Produção

- **Objetivo:** descobrir o `<email-usuario-app>` (o `INDICE_USER_EMAIL` do seed de
  Produção) e confirmar que o job `indice-seed` existe; a prova (d) depende disso.
- **Comando:**

```zsh
gcloud run jobs describe indice-seed --region "$REGION" --format=json >/dev/null \
  && SEED_PROD=existe || SEED_PROD=ausente
print "indice-seed: $SEED_PROD" | tee "$PROVAS/03-seed-prod.txt"
gcloud run jobs describe indice-seed --region "$REGION" --format=json | grep -A1 '"INDICE_USER_EMAIL"'
```

  Sem a variável (o `grep` não imprime nada), o seed usou o padrão
  `andre@indice.local`, e é esse o e-mail. Guarde (e-mail não é segredo, mas não vai
  para o repo):

```zsh
APP_EMAIL='e-mail encontrado acima'
WEB_EMAIL='sua conta Google que vai abrir a web de QA'
```

- **Saída esperada:** `indice-seed: existe` e a linha `"value": "<e-mail>"` (ou nada).
- **Prova:** `03-seed-prod.txt` (sem o e-mail).
- **Desfazer:** nada.
- **Risco:** com `indice-seed: ausente`, o `bootstrap.sh` não tem com o que comparar e
  segue sem conferir. Nesse caso **não rode o Passo 4** (ele não abortaria e criaria
  recursos) e avise o Luke.

## Passo 4 — Prova (d): bootstrap com e-mail divergente aborta [GATE]

- **Objetivo:** mostrar que o `bootstrap.sh` recusa um e-mail de usuário diferente do
  da Produção **antes de criar qualquer coisa**.
- **Comando:**

```zsh
if [[ $SEED_PROD == existe ]]; then
  infra/cloudrun/bootstrap.sh "$WEB_EMAIL" nao-e-o-usuario@example.invalid </dev/null \
    > "$PROVAS/04-prova-d.txt" 2>&1
  rc=$?; print "exit=$rc" >> "$PROVAS/04-prova-d.txt"
  if [[ $rc -ne 0 ]] && grep -q 'abortando' "$PROVAS/04-prova-d.txt" \
     && ! grep -q '==> APIs' "$PROVAS/04-prova-d.txt"; then print "PROVA_D=ok"; else print "PROVA_D=falhou"; fi \
    | tee -a "$PROVAS/04-prova-d.txt"
else
  print "PROVA_D=nao-executada (indice-seed ausente)" | tee "$PROVAS/04-prova-d.txt"
fi
```

- **Saída esperada:** `PROVA_D=ok` (saiu com erro, mensagem "difere … abortando", nenhuma
  seção "==> APIs").
- **Prova:** `04-prova-d.txt` (contém o seu `WEB_EMAIL`; fica local).
- **Desfazer:** nada foi criado. Com `PROVA_D=falhou` e "==> APIs" no arquivo, o script
  passou da conferência: avise o Luke antes de qualquer outro passo.
- **Risco:** baixo; o `if` impede rodar sem o job de Produção.

## Passo 5 — Prova (c): `neonctl branches reset` tem `--parent`

- **Objetivo:** confirmar que a versão instalada do `neonctl` suporta o reset usado pelo `qa-reset.sh`.
- **Comando:**

```zsh
neonctl branches reset --help > "$PROVAS/05-prova-c.txt" 2>&1
grep -q -- '--parent' "$PROVAS/05-prova-c.txt" && print "PROVA_C=ok" || print "PROVA_C=falhou"
```

- **Saída esperada:** `PROVA_C=ok`.
- **Prova:** `05-prova-c.txt` e a versão em `01-versoes.txt`.
- **Desfazer:** nada.
- **Risco:** com `PROVA_C=falhou`, o `qa-reset.sh` não funciona: pare e avise o Luke (bloqueio da WP02).

## Passo 6 — Branch Neon `qa`, filha da principal [CUSTO]

- **Objetivo:** criar a cópia dos dados de Produção numa branch `qa` com compute próprio
  que suspende sozinho, e já deixar provado o comando de desfazer.
- **Comando:**

```zsh
neonctl projects list
NEON_PROJECT_ID='id do projeto do Índice, da lista acima'
neonctl branches list --project-id "$NEON_PROJECT_ID"
NEON_MAIN='nome da branch principal, a que a Produção usa'
neonctl branches create --help > "$PROVAS/06-help-create.txt" 2>&1
neonctl branches delete --help > "$PROVAS/06-help-delete.txt" 2>&1
grep -i -E 'parent|compute|suspend' "$PROVAS/06-help-create.txt"
neonctl branches create --project-id "$NEON_PROJECT_ID" --name qa --parent "$NEON_MAIN"
QA_BRANCH_ID=$(neon_branch_id qa); MAIN_BRANCH_ID=$(neon_branch_id "$NEON_MAIN")
neonctl branches list --project-id "$NEON_PROJECT_ID" | tee "$PROVAS/06-neon-branch.txt"
print "qa=$QA_BRANCH_ID principal=$MAIN_BRANCH_ID" | tee -a "$PROVAS/06-neon-branch.txt"
```

  Autosuspend: no plano gratuito a suspensão por inatividade é automática. Confira no
  console do Neon (*Branches → qa → Computes*) que o compute da `qa` está com
  *scale to zero* ligado. Se `06-help-create.txt` listar uma opção de timeout de
  suspensão, pode passá-la no create. Nunca desligue o *scale to zero*.
- **Saída esperada:** `qa` em `branches list` com parent = `$NEON_MAIN` e um compute
  `read_write`; `QA_BRANCH_ID` e `MAIN_BRANCH_ID` preenchidos e diferentes.
- **Prova:** `06-neon-branch.txt`, `06-help-create.txt`, `06-help-delete.txt` e um print
  da tela do compute com *scale to zero* (sem connection string).
- **Desfazer:** antes, confira em `06-help-delete.txt` que a sintaxe é
  `neonctl branches delete <id|name>` com `--project-id`. Se não for, **não rode**:
  ajuste ao que o `--help` mostra. Apague pelo **id** (não pelo nome), com trava contra
  a principal:

```zsh
[[ -n $QA_BRANCH_ID && $QA_BRANCH_ID != "$MAIN_BRANCH_ID" ]] \
  && neonctl branches delete "$QA_BRANCH_ID" --project-id "$NEON_PROJECT_ID"
```

- **Risco:** branches dividem a cota de compute do projeto gratuito; QA gasta só quando
  acordada. A branch tem dados reais de Produção (decisão 6 do usuário).

## Passo 7 — Connection strings da `qa`, com verificação de host [GATE]

- **Objetivo:** ler as duas URLs da branch `qa` sem eco e provar, sem imprimi-las, que
  apontam para a `qa` e não para a principal.
- **Como obter:** console do Neon, *Connect* → branch **`qa`** → copiar a **pooler**
  (host com `-pooler`) acrescentando `pgbouncer=true&connection_limit=1` (com `&` se a
  URL já tiver `?`, senão com `?`), e a **direta** (host sem `-pooler`). Não cole em
  arquivo, nota ou chat.
- **Comando:**

```zsh
QA_HOST=$(neon_host qa); MAIN_HOST=$(neon_host "$NEON_MAIN")
QA_POOLER_HOST="${QA_HOST%%.*}-pooler.${QA_HOST#*.}"
MAIN_POOLER_HOST="${MAIN_HOST%%.*}-pooler.${MAIN_HOST#*.}"
read -rs 'POOLER_URL?URL pooler da qa (com pgbouncer=true&connection_limit=1): '; print
read -rs 'DIRECT_URL?URL direta da qa: '; print
# Host = entre o @ e a próxima / ou :. Nada é impresso.
h=${POOLER_URL#*@}; h=${h%%/*}; POOLER_HOST=${h%%:*}
h=${DIRECT_URL#*@}; h=${h%%/*}; DIRECT_HOST=${h%%:*}; unset h
GATE_P7=falhou
if [[ -n $QA_HOST && -n $MAIN_HOST && "$QA_HOST" != "$MAIN_HOST" \
   && "$DIRECT_HOST" == "$QA_HOST" && "$POOLER_HOST" == "$QA_POOLER_HOST" \
   && "$DIRECT_HOST" != "$MAIN_HOST" && "$POOLER_HOST" != "$MAIN_POOLER_HOST" \
   && "$POOLER_URL" == *pgbouncer=true* && "$POOLER_URL" == *connection_limit=1* \
   && "$DIRECT_URL" != *-pooler* ]]; then GATE_P7=ok; fi
print "GATE_P7=$GATE_P7" | tee "$PROVAS/07-gate-hosts.txt"
```

- **Saída esperada:** `GATE_P7=ok`. Allowlist: o host direto tem de ser **exatamente**
  o do compute da `qa`, e o pooler exatamente o mesmo com `-pooler`; nenhum dos dois
  pode ser o da principal.
- **Prova:** `07-gate-hosts.txt` (só o resultado do gate).
- **Desfazer:** com `GATE_P7=falhou`, `unset POOLER_URL DIRECT_URL` e recopie do console
  (provavelmente a branch errada no *Connect*). Se uma URL vazou, troque a senha do
  papel do banco da `qa` no console do Neon e recopie.
- **Risco:** **URL da principal num secret de QA faria QA, e a migração do primeiro
  deploy, escrever na Produção.** O Passo 8 só roda com este gate `ok`.

## Passo 8 — `bootstrap.sh` [ALERTA PRODUÇÃO] [CUSTO] [GATE]

- **Objetivo:** criar WIF, conta `gh-deployer`, repositório `indice-qa`, limpeza nos dois
  repositórios, secrets de QA, jobs `indice-seed-qa` e `indice-rekey-qa`.
- **Por que é alerta de Produção:**
  - aplica a política de limpeza também no repositório **`indice` da Produção**: as
    versões de `indice-api` e `indice-web` além das 10 mais recentes passam a ser
    **apagadas de verdade**. **Imagem apagada não tem rollback: restaurar a política
    depois não traz nenhuma imagem de volta**, e uma revisão antiga do Cloud Run que
    dependa dela deixa de servir como alvo de rollback. A imagem que serve hoje é a
    mais recente e fica;
  - adiciona papéis de IAM no projeto (`gh-deployer`: `cloudbuild.builds.editor`,
    `logging.viewer`, `serviceusage.serviceUsageConsumer`; `serviceAccountUser` na
    conta do build; `storage.admin` no bucket do Cloud Build).
- **8.1 Registro do estado atual (antes):**

```zsh
gcloud artifacts repositories describe indice --location "$REGION" \
  --format='json(cleanupPolicies,cleanupPolicyDryRun)' > "$PROVAS/08-antes-indice.json"
python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print("politicas_antes=%d dry_run_antes=%s" % (len(d.get("cleanupPolicies") or {}), d.get("cleanupPolicyDryRun", False)))' \
  "$PROVAS/08-antes-indice.json" | tee "$PROVAS/08-antes-resumo.txt"
# indice-qa: se já existir, a política dele também precisa estar vazia
gcloud artifacts repositories describe indice-qa --location "$REGION" \
  --format='json(cleanupPolicies,cleanupPolicyDryRun)' > "$PROVAS/08-antes-indice-qa.json" 2>/dev/null \
  || print '{}' > "$PROVAS/08-antes-indice-qa.json"
python3 -I -c 'import json,sys; d=json.load(open(sys.argv[1])); print("politicas_antes_qa=%d" % len(d.get("cleanupPolicies") or {}))' \
  "$PROVAS/08-antes-indice-qa.json" | tee -a "$PROVAS/08-antes-resumo.txt"
for img in indice-api indice-web; do
  gcloud artifacts docker images list "$REGION-docker.pkg.dev/$PROJECT_ID/indice/$img" \
    --include-tags --format='value(version,tags,createTime)' --sort-by=~createTime
done > "$PROVAS/08-antes-imagens-prod.txt"
gcloud run services describe indice-api --region "$REGION" \
  --format='value(spec.template.spec.containers[0].image)' >> "$PROVAS/08-antes-imagens-prod.txt"
```

  Esperado: `politicas_antes=0` e `politicas_antes_qa=0`. **Se algum for maior que 0,
  pare e avise o Luke**: a política existente seria substituída e a restauração
  exigiria reescrevê-la à mão a partir do JSON salvo.

  **Inventário do que já existe** (o `bootstrap.sh` só cria o que falta, então o
  desfazer precisa saber o que é dele). Cada linha sai `existia`, `ausente` ou `erro`:
  `ausente` só quando o Google responde "não encontrado" (ou a listagem vem vazia);
  qualquer outro erro (permissão, rede) vira `erro` e bloqueia o Passo 8.

```zsh
SA_DEPLOY="gh-deployer@$PROJECT_ID.iam.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
BUILD_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
BUILD_BUCKET="gs://${PROJECT_ID}_cloudbuild"
# Listagem: saída não vazia = existe; vazia = não encontrado; falha = repassa o erro.
tem() { local o; o=$("$@") || return 2; [[ -n $o ]] || { print -u2 NOT_FOUND; return 1; }; }
inv() { local nome=$1 err; shift
  if err=$("$@" 2>&1 >/dev/null); then print "$nome=existia"
  elif [[ $err == *(NOT_FOUND|not found|does not exist|was not found)* ]]; then print "$nome=ausente"
  else print "$nome=erro"; fi; }
bind() { print "--flatten=bindings"
         print "--filter=bindings.role=$1 AND bindings.members:serviceAccount:$SA_DEPLOY"
         print "--format=value(bindings.role)"; }
{
  inv wif_pool          gcloud iam workload-identity-pools describe github --location global
  inv wif_provider      gcloud iam workload-identity-pools providers describe github-oidc --location global --workload-identity-pool github
  inv sa_gh_deployer    gcloud iam service-accounts describe "$SA_DEPLOY"
  inv bucket_cloudbuild gcloud storage buckets describe "$BUILD_BUCKET"
  inv ar_indice_qa      gcloud artifacts repositories describe indice-qa --location "$REGION"
  for sec in indice-qa-database-url indice-qa-database-url-direct indice-qa-api-key; do
    inv "secret_$sec" gcloud secrets describe "$sec"
    inv "versao_$sec" tem gcloud secrets versions list "$sec" --filter=state=ENABLED --format='value(name)'
  done
  for job in indice-seed-qa indice-rekey-qa; do inv "job_$job" gcloud run jobs describe "$job" --region "$REGION"; done
  for role in roles/cloudbuild.builds.editor roles/logging.viewer roles/serviceusage.serviceUsageConsumer; do
    inv "bind_projeto_${role#roles/}" tem gcloud projects get-iam-policy "$PROJECT_ID" ${(f)"$(bind $role)"}
  done
  inv bind_build_sa_user tem gcloud iam service-accounts get-iam-policy "$BUILD_SA" ${(f)"$(bind roles/iam.serviceAccountUser)"}
  inv bind_bucket_admin  tem gcloud storage buckets get-iam-policy "$BUILD_BUCKET" ${(f)"$(bind roles/storage.admin)"}
  for api in iam iamcredentials sts; do
    inv "api_$api" tem gcloud services list --enabled --filter="config.name=$api.googleapis.com" --format='value(config.name)'
  done
} | tee "$PROVAS/08-inventario-antes.txt"
print "inventario: $(grep -c -E '=(existia|ausente)$' "$PROVAS/08-inventario-antes.txt") de 21 linhas válidas, $(grep -c '=erro$' "$PROVAS/08-inventario-antes.txt") erro(s)"
```

  Esperado: `inventario: 21 de 21 linhas válidas, 0 erro(s)`. Num primeiro
  provisionamento quase tudo sai `ausente` (as APIs podem sair `existia`; bucket e
  vínculo do bucket saem `ausente` se o bucket não existe). Qualquer `erro`: pare e
  avise o Luke. **Não edite o inventário à mão.**
- **8.2 Confirmação explícita para tocar a Produção:**

```zsh
read 'CONF?Imagens apagadas da Produção não voltam. Digite APLICAR-LIMPEZA-EM-PRODUCAO: '
[[ $CONF == APLICAR-LIMPEZA-EM-PRODUCAO ]] && GATE_P8=ok || GATE_P8=falhou
grep -q '^politicas_antes=0 ' "$PROVAS/08-antes-resumo.txt" || GATE_P8=falhou
grep -qx 'politicas_antes_qa=0' "$PROVAS/08-antes-resumo.txt" || GATE_P8=falhou
[[ $(grep -c -E '=(existia|ausente)$' "$PROVAS/08-inventario-antes.txt") -eq 21 ]] || GATE_P8=falhou
grep -q '=erro$' "$PROVAS/08-inventario-antes.txt" && GATE_P8=falhou
print "GATE_P8=$GATE_P8" | tee "$PROVAS/08-gate.txt"
```

- **8.3 Execução** (as URLs vão do shell para o stdin do script; a chave de QA fica
  vazia e o script gera uma aleatória direto no Secret Manager):

```zsh
if [[ $GATE_P7 == ok && $GATE_P8 == ok ]]; then
  printf '%s\n%s\n\n' "$POOLER_URL" "$DIRECT_URL" \
    | infra/cloudrun/bootstrap.sh "$WEB_EMAIL" "$APP_EMAIL" > "$PROVAS/08-bootstrap-1.txt" 2>&1
  print "exit=$?" | tee -a "$PROVAS/08-bootstrap-1.txt"
else
  print "gates não passaram: bootstrap NÃO executado"
fi
unset POOLER_URL DIRECT_URL
for repo in indice indice-qa; do
  gcloud artifacts repositories describe "$repo" --location "$REGION" \
    --format='json(cleanupPolicies,cleanupPolicyDryRun)' > "$PROVAS/08-depois-$repo.json"
  politica_ok "$PROVAS/08-depois-$repo.json" && print "$repo: politica=ok" || print "$repo: politica=falhou"
done | tee "$PROVAS/08-depois-resumo.txt"
grep -c -E 'postgres|npg_' "$PROVAS/08-bootstrap-1.txt"
```

- **Saída esperada:** `exit=0`; no arquivo, "confere com o seed de Produção", provider
  `github-oidc` criado, três secrets criados, jobs criados, "indice-web-qa ainda não
  existe: rode este script de novo…" e as linhas `GCP_PROJECT_ID=`, `GCP_WIF_PROVIDER=`,
  `GCP_DEPLOY_SA=`. `indice: politica=ok` e `indice-qa: politica=ok`. O `grep -c`
  final imprime `0` (nenhuma URL no log).
- **Prova:** `08-antes-*.{json,txt}`, `08-inventario-antes.txt`, `08-gate.txt`, `08-bootstrap-1.txt`,
  `08-depois-*.json`, `08-depois-resumo.txt`.
- **Desfazer** — remove **só** o que o Passo 8 criou ou alterou, lendo
  `08-inventario-antes.txt`. Recurso marcado `existia` (ou sem linha válida no
  inventário) é recusado e fica. Primeiro as funções:

```zsh
INV="$PROVAS/08-inventario-antes.txt"
SA_DEPLOY="gh-deployer@$PROJECT_ID.iam.gserviceaccount.com"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
BUILD_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
BUILD_BUCKET="gs://${PROJECT_ID}_cloudbuild"
# Roda o comando só se o recurso estava ausente antes do Passo 8.
se_criado() { local nome=$1; shift
  if grep -qx "$nome=ausente" "$INV"; then print "$nome: criado no Passo 8, removendo"; "$@"
  elif grep -qx "$nome=existia" "$INV"; then print "$nome: existia antes do Passo 8, NÃO removido"
  else print "$nome: sem inventário válido, NÃO removido"; fi; }
```

  Depois, na ordem (cada linha decide sozinha):

```zsh
# 1. limpeza (alteração em repositório que já existia). Não traz de volta imagens
#    já apagadas. O indice-qa criado no Passo 8 sai inteiro no item 4.
grep -q '^politicas_antes=0 ' "$PROVAS/08-antes-resumo.txt" \
  && gcloud artifacts repositories delete-cleanup-policies indice --location "$REGION" \
       --policynames=apagar-antigas,manter-10-recentes
grep -q 'dry_run_antes=True' "$PROVAS/08-antes-resumo.txt" \
  && gcloud artifacts repositories set-cleanup-policies indice --location "$REGION" --dry-run
grep -qx 'ar_indice_qa=existia' "$INV" && grep -qx 'politicas_antes_qa=0' "$PROVAS/08-antes-resumo.txt" \
  && gcloud artifacts repositories delete-cleanup-policies indice-qa --location "$REGION" \
       --policynames=apagar-antigas,manter-10-recentes
# 2. jobs
se_criado job_indice-rekey-qa gcloud run jobs delete indice-rekey-qa --region "$REGION"
se_criado job_indice-seed-qa  gcloud run jobs delete indice-seed-qa  --region "$REGION"
# 3. secrets: criado → apaga o secret; existia sem versão ativa → destrói as versões
#    ativas de agora (todas gravadas no Passo 8, porque antes não havia nenhuma)
destruir_versoes() { local v
  for v in ${(f)"$(gcloud secrets versions list "$1" --filter=state=ENABLED --format='value(name)')"}; do
    gcloud secrets versions destroy "${v##*/}" --secret "$1"
  done; }
for sec in indice-qa-database-url indice-qa-database-url-direct indice-qa-api-key; do
  if grep -qx "secret_$sec=ausente" "$INV"; then
    se_criado "secret_$sec" gcloud secrets delete "$sec"
  else
    se_criado "versao_$sec" destruir_versoes "$sec"
  fi
done
# 4. repositório de QA
se_criado ar_indice_qa gcloud artifacts repositories delete indice-qa --location "$REGION"
# 5. vínculos de IAM (antes de apagar a conta)
se_criado bind_bucket_admin gcloud storage buckets remove-iam-policy-binding "$BUILD_BUCKET" \
  --member "serviceAccount:$SA_DEPLOY" --role roles/storage.admin
se_criado bind_build_sa_user gcloud iam service-accounts remove-iam-policy-binding "$BUILD_SA" \
  --member "serviceAccount:$SA_DEPLOY" --role roles/iam.serviceAccountUser
for role in roles/cloudbuild.builds.editor roles/logging.viewer roles/serviceusage.serviceUsageConsumer; do
  se_criado "bind_projeto_${role#roles/}" gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
    --member "serviceAccount:$SA_DEPLOY" --role "$role" --condition None
done
# 6. conta, provider, pool, bucket
se_criado sa_gh_deployer gcloud iam service-accounts delete "$SA_DEPLOY"
se_criado wif_provider gcloud iam workload-identity-pools providers delete github-oidc \
  --location global --workload-identity-pool github
se_criado wif_pool gcloud iam workload-identity-pools delete github --location global   # 30 dias em soft delete; "undelete" recupera
se_criado bucket_cloudbuild gcloud storage rm --recursive "$BUILD_BUCKET"
```

  APIs ligadas pelo bootstrap (`api_*=ausente`) **não** são desligadas: não cobram e
  desligá-las pode quebrar outros serviços do projeto. O
  `roles/iam.workloadIdentityUser` na `gh-deployer` some junto com a conta criada; se a
  conta `existia`, ele fica (pode ter vindo antes; confira com `get-iam-policy` e
  remova à mão só se não estava lá). O `secretAccessor` da conta do Cloud Run nos
  secrets de QA sai junto com cada secret apagado.
- **Risco:** o script aborta no meio se um provider `github-oidc` já existir diferente
  do esperado (trava de segurança): corrija com `update-oidc` e rode de novo.

## Passo 9 — Prova (a): limpeza efetiva e bootstrap idempotente [GATE]

- **Objetivo:** mostrar as duas regras e o dry-run desligado em `indice` e `indice-qa`
  depois de uma **segunda** execução do bootstrap, idênticos ao estado depois da
  primeira, e que a segunda execução não cria nada.
- **Comando:**

```zsh
infra/cloudrun/bootstrap.sh "$WEB_EMAIL" "$APP_EMAIL" </dev/null > "$PROVAS/09-bootstrap-2.txt" 2>&1
print "exit=$?" >> "$PROVAS/09-bootstrap-2.txt"
PROVA_A=ok
for repo in indice indice-qa; do
  gcloud artifacts repositories describe "$repo" --location "$REGION" \
    --format='json(cleanupPolicies,cleanupPolicyDryRun)' > "$PROVAS/09-depois-2-$repo.json"
  politica_ok "$PROVAS/09-depois-2-$repo.json" || PROVA_A=falhou
  diff -q "$PROVAS/08-depois-$repo.json" "$PROVAS/09-depois-2-$repo.json" >/dev/null || PROVA_A=falhou
done
grep -q '^exit=0$' "$PROVAS/09-bootstrap-2.txt" || PROVA_A=falhou
grep -q 'provider github-oidc confere' "$PROVAS/09-bootstrap-2.txt" || PROVA_A=falhou
[[ $(grep -c 'já tem versão ativa, mantida' "$PROVAS/09-bootstrap-2.txt") -eq 3 ]] || PROVA_A=falhou
grep -q -i 'created' "$PROVAS/09-bootstrap-2.txt" && PROVA_A=falhou
print "PROVA_A=$PROVA_A" | tee "$PROVAS/09-prova-a.txt"
```

- **Saída esperada:** `PROVA_A=ok`: os dois repositórios com `apagar-antigas` e
  `manter-10-recentes` (keepCount 10), `cleanupPolicyDryRun` ausente/falso, describe
  idêntico ao do Passo 8 (`diff` vazio), segunda execução com `exit=0`, provider
  conferido, os três secrets mantidos, sem prompt e sem "Created".
- **Prova:** `09-bootstrap-2.txt`, `09-depois-2-*.json`, `09-prova-a.txt`.
- **Desfazer:** nada (leitura e reaplicação idempotente).
- **Risco:** com `PROVA_A=falhou`, abra os arquivos para ver qual condição caiu. Se for
  o dry-run, o PATCH do script falhou (desvio registrado em `bloqueios.md`): avise o Luke.

## Passo 10 — Variables do repositório GitHub [GATE]

- **Objetivo:** dar ao `deploy.yml` os identificadores (não secretos) do GCP, lidos da
  prova do bootstrap, **sem sobrescrever** variable que já exista com outro valor.
  Tem de terminar com `GATE_P10=ok` **antes** do merge do Passo 11, senão o deploy falha
  na autenticação.
- **Comando:**

```zsh
WIF_PROVIDER=$(sed -n 's/^GCP_WIF_PROVIDER=//p' "$PROVAS/08-bootstrap-1.txt" | tail -1)
DEPLOY_SA=$(sed -n 's/^GCP_DEPLOY_SA=//p' "$PROVAS/08-bootstrap-1.txt" | tail -1)
# Estado de cada variable num `gh variable list --json`: ausente, igual ou diferente
# do esperado. Os valores são identificadores públicos; podem ficar na prova.
estado_vars() {
  python3 -I -c '
import json, sys
atual = {v["name"]: v.get("value") for v in json.load(open(sys.argv[1]))}
for par in sys.argv[2:]:
    nome, esperado = par.split("=", 1)
    print("%s=%s" % (nome, "ausente" if nome not in atual else "igual" if atual[nome] == esperado else "diferente"))
' "$1" "GCP_PROJECT_ID=$PROJECT_ID" "GCP_WIF_PROVIDER=$WIF_PROVIDER" "GCP_DEPLOY_SA=$DEPLOY_SA"
}
GATE_P10=falhou
rm -f "$PROVAS/10-estado-antes.txt"
if [[ $WIF_PROVIDER =~ '^projects/[0-9]+/locations/global/workloadIdentityPools/github/providers/github-oidc$' \
   && $DEPLOY_SA == "gh-deployer@$PROJECT_ID.iam.gserviceaccount.com" ]]; then
  gh variable list --repo "$GH_REPO" --json name,value > "$PROVAS/10-antes.json" \
    && estado_vars "$PROVAS/10-antes.json" > "$PROVAS/10-estado-antes.txt" 2>/dev/null
  cat "$PROVAS/10-estado-antes.txt" 2>/dev/null
  if [[ $(grep -c -E '=(ausente|igual|diferente)$' "$PROVAS/10-estado-antes.txt" 2>/dev/null) -ne 3 ]]; then
    print "não consegui ler as variables atuais: nada alterado"
  elif grep -q '=diferente$' "$PROVAS/10-estado-antes.txt"; then
    print "variable já existe com outro valor (ver 10-antes.json): nada alterado, avise o Luke"
  else
    for nome valor in GCP_PROJECT_ID "$PROJECT_ID" GCP_WIF_PROVIDER "$WIF_PROVIDER" GCP_DEPLOY_SA "$DEPLOY_SA"; do
      grep -qx "$nome=ausente" "$PROVAS/10-estado-antes.txt" \
        && gh variable set "$nome" --repo "$GH_REPO" --body "$valor"
    done
    gh variable list --repo "$GH_REPO" --json name,value > "$PROVAS/10-depois.json" \
      && [[ $(estado_vars "$PROVAS/10-depois.json" | grep -c '=igual$') -eq 3 ]] && GATE_P10=ok
  fi
else
  print "valores da prova do bootstrap fora do formato: variables NÃO criadas"
fi
print "GATE_P10=$GATE_P10" | tee "$PROVAS/10-gate.txt"
```

- **Saída esperada:** `GATE_P10=ok`. Variable que já existia com o mesmo valor fica como
  está (rerun idempotente); com valor diferente, nada é alterado e o gate falha.
  **Variables**, não *secrets*: são identificadores públicos por natureza.
- **Prova:** `10-antes.json`, `10-estado-antes.txt`, `10-depois.json`, `10-gate.txt`.
- **Desfazer:** apaga só as variables que estavam `ausente` antes deste passo; as que
  já existiam ficam com o valor de sempre (este passo não as alterou):

```zsh
for nome in GCP_PROJECT_ID GCP_WIF_PROVIDER GCP_DEPLOY_SA; do
  if grep -qx "$nome=ausente" "$PROVAS/10-estado-antes.txt"; then
    gh variable delete "$nome" --repo "$GH_REPO"
  else
    print "$nome: existia antes do Passo 10 (ou sem registro), NÃO removida"
  fi
done
```

- **Risco:** nenhum segredo envolvido. Não crie nenhum *secret* de GCP no GitHub.

## Passo 11 — Primeiro deploy de QA [ESPERA] [CUSTO]

- **Ponto de espera:** este passo só acontece quando o PR `feat/002-infra-ambientes` →
  `development` for **mergeado** (Chewie, com a sua autorização, CI verde). O merge
  dispara o `deploy.yml` pela primeira vez. Até lá, pare aqui.
- **Antes do merge [GATE]:** só autorize o merge ao Chewie com `PRE_MERGE=ok`:

```zsh
PRE_MERGE=ok
grep -qx 'GATE_P7=ok'  "$PROVAS/07-gate-hosts.txt"  || PRE_MERGE=falhou
grep -qx 'GATE_P8=ok'  "$PROVAS/08-gate.txt"        || PRE_MERGE=falhou
grep -qx 'exit=0'      "$PROVAS/08-bootstrap-1.txt" || PRE_MERGE=falhou
grep -qx 'PROVA_A=ok'  "$PROVAS/09-prova-a.txt"     || PRE_MERGE=falhou
grep -qx 'GATE_P10=ok' "$PROVAS/10-gate.txt"        || PRE_MERGE=falhou
print "PRE_MERGE=$PRE_MERGE" | tee "$PROVAS/11-pre-merge.txt"
```

  E **ninguém mergeia nada em `main`** até a WP05 configurar o Environment `production`
  com você como revisor: sem ele, um merge em `main` publicaria em Produção sem pedir
  aprovação.
- **Objetivo:** ver `indice-api-qa` e `indice-web-qa` nascerem com a imagem do commit mergeado.
- **Comando** (depois do merge):

```zsh
gh run list --repo "$GH_REPO" --workflow deploy.yml --limit 3
RUN_ID=$(gh run list --repo "$GH_REPO" --workflow deploy.yml --branch development --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch --repo "$GH_REPO" "$RUN_ID" --exit-status; print "run_exit=$?" | tee "$PROVAS/11-deploy-qa.txt"
MERGE_SHA=$(gh api "repos/$GH_REPO/commits/development" --jq .sha)
print "run=$RUN_ID merge=$MERGE_SHA" >> "$PROVAS/11-deploy-qa.txt"
for svc in indice-api-qa indice-web-qa; do
  gcloud run services describe "$svc" --region "$REGION" \
    --format='value(metadata.name,spec.template.spec.containers[0].image,status.url)'
done | tee -a "$PROVAS/11-deploy-qa.txt"
curl -s -o /dev/null -w 'health=%{http_code}\n' \
  "$(gcloud run services describe indice-api-qa --region "$REGION" --format='value(status.url)')/health" \
  | tee -a "$PROVAS/11-deploy-qa.txt"
```

- **Saída esperada:** `run_exit=0` (jobs `ci / node`, `ci / android`, `deploy` verdes);
  as duas imagens em `…/indice-qa/indice-{api,web}:<MERGE_SHA>`; `health=200`.
  `indice-api` e `indice-web` (Produção) **sem** revisão nova.
- **Prova:** `11-pre-merge.txt` e `11-deploy-qa.txt` (id da execução do Actions incluído).
- **Desfazer:** não existe rollback completo. Inventário de **tudo** o que este roteiro
  cria, para remoção manual, na ordem:
  1. Cloud Run: serviços `indice-web-qa`, `indice-api-qa`
     (`gcloud run services delete <svc> --region "$REGION"`).
  2. Cloud Run Jobs: `indice-migrate-qa`, `indice-seed-qa`, `indice-rekey-qa`
     (`gcloud run jobs delete <job> --region "$REGION"`).
  3. Artifact Registry: repositório `indice-qa` com as imagens; política de limpeza em
     `indice` (Passo 8, "Desfazer", guiado pelo inventário).
  4. Secret Manager: `indice-qa-database-url`, `indice-qa-database-url-direct`,
     `indice-qa-api-key`.
  5. IAM: conta `gh-deployer` e seus vínculos; pool `github` e provider `github-oidc`;
     `roles/run.invoker` de `$WEB_EMAIL` em `indice-web-qa` (sai com o serviço).
  6. GitHub: variables `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`; execuções
     do Actions ficam no histórico.
  7. Neon: branch `qa` (Passo 6, "Desfazer").
  **Migração aplicada na `qa` não se desfaz**: só sai resetando a branch
  (`infra/cloudrun/qa-reset.sh`) ou apagando-a. Builds e logs do Cloud Build ficam no
  histórico.
- **Risco:** a migração roda contra a `qa`; o gate do Passo 7 garante o host. No
  primeiro deploy o `CORS_ORIGIN` da API de QA fica `*` uma vez (previsto). Plano B, se o
  Actions falhar na autenticação: deploy manual de QA conforme o README ("Primeiro
  deploy"), sem tocar Produção.

## Passo 12 — Prova (b): build sem `_TAG` falha antes de qualquer passo docker [CUSTO mínimo] [GATE]

- **Objetivo:** provar, com código de saída e log do build, que sem `_TAG` (ausente ou
  vazia) o Cloud Build recusa a submissão ou falha no passo `guard-tag`, antes de
  qualquer `docker build`/`push`.
- **Comando** (de um clone limpo, para não enviar arquivos locais não versionados; usa
  as substituições de QA, então nem o pior caso toca Produção):

```zsh
git clone --depth 1 --branch development "https://github.com/$GH_REPO.git" /tmp/indice-wp04
cd /tmp/indice-wp04
QA_SUBS='_REPO=indice-qa,_SUFFIX=-qa,_WEB_AUTH=--no-allow-unauthenticated,_DB_SECRET=indice-qa-database-url,_DB_DIRECT_SECRET=indice-qa-database-url-direct,_API_KEY_SECRET=indice-qa-api-key'
gcloud artifacts docker images list "$REGION-docker.pkg.dev/$PROJECT_ID/indice-qa" --include-tags \
  --format='value(package,tags)' > "$PROVAS/12-imagens-antes.txt"

# Uma tentativa: submit sem pipe (exit real), id do build criado depois de T0,
# e conferência do build: FAILURE, passo 0 = guard-tag em FAILURE, nenhum outro
# passo em SUCCESS/WORKING, log com a mensagem da guarda.
prova_b() {  # $1 = rótulo, $2 = substituições
  local t0 rc ids id
  t0=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  gcloud builds submit --config infra/cloudrun/cloudbuild.yaml --substitutions "$2" . \
    > "$PROVAS/12-$1-submit.log" 2>&1
  rc=$?; print "submit_exit=$rc" >> "$PROVAS/12-$1-submit.log"
  ids=$(gcloud builds list --filter="createTime>=\"$t0\"" --format='value(id)')
  if [[ $rc -eq 0 ]]; then print "PROVA_B_$1=falhou (submit saiu 0)"; return 1; fi
  if [[ -z $ids ]]; then print "PROVA_B_$1=ok (recusado na submissão, nenhum build criado)"; return 0; fi
  for id in ${(f)ids}; do
    gcloud builds describe "$id" --format=json > "$PROVAS/12-$1-build-$id.json"
    gcloud builds log "$id" > "$PROVAS/12-$1-build-$id.log" 2>&1
    python3 -I -c '
import json, sys
b = json.load(open(sys.argv[1])); s = b.get("steps", [])
first = s[0] if s else {}
rest = [x.get("status", "") for x in s[1:]]
ok = (b.get("status") == "FAILURE" and first.get("id") == "guard-tag"
      and first.get("status") == "FAILURE" and all(r not in ("SUCCESS", "WORKING") for r in rest))
print("build=%s status=%s guard-tag=%s demais=%s" % (b.get("id"), b.get("status"), first.get("status"), sorted(set(rest))))
sys.exit(0 if ok else 1)
' "$PROVAS/12-$1-build-$id.json" || { print "PROVA_B_$1=falhou (build $id)"; return 1; }
    grep -q '_TAG vazia' "$PROVAS/12-$1-build-$id.log" || { print "PROVA_B_$1=falhou (log sem guarda)"; return 1; }
  done
  print "PROVA_B_$1=ok (guard-tag falhou antes dos passos docker)"
}
{ prova_b sem-tag "$QA_SUBS"; prova_b tag-vazia "_TAG=,$QA_SUBS"; } | tee "$PROVAS/12-prova-b.txt"

gcloud artifacts docker images list "$REGION-docker.pkg.dev/$PROJECT_ID/indice-qa" --include-tags \
  --format='value(package,tags)' > "$PROVAS/12-imagens-depois.txt"
diff -q "$PROVAS/12-imagens-antes.txt" "$PROVAS/12-imagens-depois.txt" >/dev/null \
  && print "imagens=sem-mudanca" || print "imagens=MUDARAM"
cd ~/Documents/GitHub/indice
```

- **Saída esperada:** `PROVA_B_sem-tag=ok (…)`, `PROVA_B_tag-vazia=ok (…)` e
  `imagens=sem-mudanca`. Cada linha diz se o build foi recusado na submissão ou
  criado e barrado no passo 0.
- **Prova:** `12-prova-b.txt`, `12-*-submit.log`, `12-*-build-*.json` e `.log`,
  `12-imagens-{antes,depois}.txt`.
- **Desfazer:** build falho não deixa recurso. `rm -rf /tmp/indice-wp04`.
- **Risco:** se um build estiver em andamento além do passo 0, cancele
  (`gcloud builds cancel <id>`) e avise o Luke. `imagens=MUDARAM` também é falha.

## Passo 13 — Seed e rekey de QA; chaves cruzadas

- **Objetivo:** registrar a chave de QA no usuário copiado, remover da `qa` a chave de
  Produção que veio na cópia e provar o isolamento das chaves.
- **Comando:**

```zsh
IMAGE_QA=$(gcloud run services describe indice-api-qa --region "$REGION" \
  --format='value(spec.template.spec.containers[0].image)')
gcloud run jobs update indice-seed-qa  --region "$REGION" --image "$IMAGE_QA"
gcloud run jobs update indice-rekey-qa --region "$REGION" --image "$IMAGE_QA"
gcloud run jobs execute indice-seed-qa  --region "$REGION" --wait
gcloud run jobs execute indice-rekey-qa --region "$REGION" --wait

API_QA=$(gcloud run services describe indice-api-qa --region "$REGION" --format='value(status.url)')
API_PROD=$(gcloud run services describe indice-api --region "$REGION" --format='value(status.url)')
# A chave sai do Secret Manager pelo stdout, vira cabeçalho no awk (que lê do
# stdin) e chega ao curl pelo stdin (-H @-): nunca em argumento, arquivo ou tela.
status_com_chave() {  # $1 = URL da API, $2 = nome do secret
  gcloud secrets versions access latest --secret "$2" \
    | awk '{ printf "X-Api-Key: %s\n", $0 }' \
    | curl -s -o /dev/null -w "%{http_code}  $1  chave=$2\n" -H @- "$1/habits/today"
}
{ status_com_chave "$API_QA" indice-qa-api-key;  status_com_chave "$API_QA" indice-api-key
  status_com_chave "$API_PROD" indice-api-key;   status_com_chave "$API_PROD" indice-qa-api-key
} | tee "$PROVAS/13-chaves.txt"
```

- **Saída esperada:** os dois jobs `succeeded`. Em `13-chaves.txt`: QA+chave QA `200`,
  QA+chave Prod `401`, Prod+chave Prod `200`, Prod+chave QA `401`.
- **Prova:** `13-chaves.txt` (só códigos HTTP, URLs e **nomes** de secret).
- **Desfazer:** o seed só faz upsert e o rekey só apaga `ApiKey` na `qa`. Para voltar
  ao estado da cópia: `infra/cloudrun/qa-reset.sh`.
- **Risco:** QA+chave QA dando `401` indica que o seed não achou o usuário certo
  (e-mail) ou não rodou antes do rekey: rode de novo na ordem seed → rekey. O comando
  lê o secret da chave de **Produção** (só leitura), para a prova cruzada.

## Passo 14 — Acesso à web de QA: `run.invoker` e proxy na porta 3100

- **Objetivo:** só a sua conta abre `indice-web-qa`; acesso anônimo recusado.
- **Comando:**

```zsh
infra/cloudrun/bootstrap.sh "$WEB_EMAIL" "$APP_EMAIL" </dev/null > "$PROVAS/14-bootstrap-3.txt" 2>&1
print "exit=$?" >> "$PROVAS/14-bootstrap-3.txt"
gcloud run services get-iam-policy indice-web-qa --region "$REGION" --format='yaml(bindings)' \
  | tee "$PROVAS/14-iam-web-qa.txt"
grep -q allUsers "$PROVAS/14-iam-web-qa.txt" && print "ALERTA: allUsers na web de QA" || print "sem allUsers"
WEB_QA=$(gcloud run services describe indice-web-qa --region "$REGION" --format='value(status.url)')
curl -s -o /dev/null -w "anonimo=%{http_code}\n" "$WEB_QA/" | tee -a "$PROVAS/14-iam-web-qa.txt"
```

  Depois, o proxy. **Ele roda em primeiro plano e prende o terminal** até Ctrl-C: rode
  por último, ou em outra aba (com as mesmas variáveis de sessão).

```zsh
gcloud run services proxy indice-web-qa --region "$REGION" --port 3100
# navegador: http://localhost:3100 ; Ctrl-C encerra o proxy
```

- **Saída esperada:** `exit=0`; política com `roles/run.invoker` só para
  `user:<WEB_EMAIL>`; "sem allUsers"; `anonimo=403`; pelo proxy a página carrega com os
  dados copiados da Produção.
- **Prova:** `14-bootstrap-3.txt`, `14-iam-web-qa.txt` e um print da página pelo proxy
  (sem dados sensíveis visíveis, se possível).
- **Desfazer:** `gcloud run services remove-iam-policy-binding indice-web-qa --region "$REGION" --member "user:$WEB_EMAIL" --role roles/run.invoker`.
- **Risco:** "ALERTA: allUsers" = web de QA pública com dados reais: remova **na hora**
  (`gcloud run services remove-iam-policy-binding indice-web-qa --region "$REGION" --member allUsers --role roles/run.invoker`)
  e avise o Luke. Não abre no celular (previsto).

## Passo 15 — Fechamento

- **Objetivo:** entregar a evidência e devolver o ambiente local ao estado do Passo 1.
- **Comando** (com o proxy do Passo 14 já encerrado):

```zsh
grep -l -E 'postgres(ql)?://|npg_|BEGIN .*KEY' "$PROVAS"/* || print "provas sem segredo"
grep -h -E '^(PROVA_|GATE_|PRE_MERGE=|imagens=|anonimo=|health=|run_exit=)' "$PROVAS"/*.txt
unset NEON_API_KEY CLOUDSDK_CORE_PROJECT
grep -q '^neonctl_preexistente=nao$' "$PROVAS/01-estado-local.txt" && npm uninstall -g neonctl
gcloud config get project   # deve ser igual a projeto_gcloud_anterior em 01-estado-local.txt
```

- **Saída esperada:** "provas sem segredo"; todas as linhas `PROVA_*`, `GATE_*` com `ok`,
  `imagens=sem-mudanca`, `anonimo=403`, `health=200`, `run_exit=0`; o projeto do
  `gcloud` igual ao anterior.
- **Prova:** o resumo acima; mande ao Luke passos ok/falhos, ids de build e da execução
  do Actions, **sem** colar e-mails nem valores.
- **Desfazer:** se precisar do `neonctl` de novo (por exemplo, para o `qa-reset.sh`),
  `npm i -g neonctl`.
- **Risco:** a WP05 (proteção de branches e Environments, com o Chewie) vem em seguida e
  é pré-requisito de qualquer merge em `main`. Se o proxy ainda estiver aberto, encerre
  com Ctrl-C antes.

---

## Mapa das provas obrigatórias (plan.md, WP04)

| Prova | Passo | Linha de resultado | Arquivos |
|---|---|---|---|
| (a) dois repositórios com as regras e `cleanupPolicyDryRun` falso/ausente; bootstrap idempotente | 8–9 | `PROVA_A=ok` | `08-depois-*.json`, `09-*` |
| (b) build sem `_TAG` falha antes de qualquer push | 12 | `PROVA_B_*=ok`, `imagens=sem-mudanca` | `12-*` |
| (c) `neonctl branches reset --help` lista `--parent` | 5 | `PROVA_C=ok` | `05-prova-c.txt` |
| (d) bootstrap com e-mail divergente aborta | 4 | `PROVA_D=ok` | `04-prova-d.txt` |

## Pontos de alerta, em resumo

- **Passo 8** — limpeza aplicada também no repositório da **Produção**: imagens além das
  10 mais recentes são apagadas e **não têm rollback**; exige `politicas_antes=0` e a
  frase de confirmação digitada. Também cria papéis de IAM no projeto.
- **Passo 7** — gate de host: sem `GATE_P7=ok`, o bootstrap não roda (URL da principal
  num secret de QA levaria QA e a migração a escrever na Produção).
- **Passo 8, desfazer** — só remove o que o inventário marcou `ausente` antes do passo;
  o que já existia é recusado.
- **Passo 10** — não sobrescreve variable existente com outro valor; `GATE_P10=ok`
  exigido no `PRE_MERGE`.
- **Passo 11** — `PRE_MERGE=ok` antes de autorizar o merge; nenhum merge em `main` antes da WP05; não há rollback completo
  (inventário no passo); migração aplicada só sai com reset da `qa`.
- **Passo 14** — web de QA tem dados reais; `allUsers` na política é incidente.
- **Custos:** branch Neon `qa` (cota de compute compartilhada), repositório `indice-qa`
  (armazenamento acima da faixa gratuita), Cloud Build e Cloud Run de QA (escala a zero),
  três versões de secret a mais, dois builds que falham no Passo 12.
