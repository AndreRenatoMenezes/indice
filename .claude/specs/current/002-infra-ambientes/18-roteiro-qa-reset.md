# WP06 passo 4 — reset real de QA (`qa-reset.sh`)

Identificadores do projeto Neon ficam fora deste arquivo (repositório público):
use `NEON_PROJECT_ID` exportado na sessão.

Quem roda o reset: **o usuário, no próprio terminal** (o script pede confirmação
interativa e lê `NEON_API_KEY` do ambiente). Leituras de antes/depois: Obi ou Ahsoka.
Nada aqui escreve em Produção. Nenhum valor secreto vai para tela, arquivo,
argumento de processo ou histórico.

## 1. Pré-requisitos

- **Passo 3 concluído e implantado em QA**: o job `indice-migrate-qa` tem de estar na
  mesma imagem de `indice-api-qa` (a do merge com `aceite_002_noop`). O `qa-reset.sh`
  atualiza a imagem de `indice-seed-qa` e `indice-rekey-qa`, mas **não** a do
  `indice-migrate-qa`: se o job estiver numa imagem sem a `aceite_002_noop`, ela não
  volta para QA depois do reset.

  ```zsh
  R=southamerica-east1
  A=$(gcloud run services describe indice-api-qa --region $R --format='value(spec.template.spec.containers[0].image)')
  J=$(gcloud run jobs describe indice-migrate-qa --region $R --format='value(spec.template.spec.template.spec.containers[0].image)')
  [[ $A == "$J" ]] && print "PRE_IMAGEM=ok" || print "PRE_IMAGEM=falhou (job de migração em outra imagem)"
  ```
- `gcloud` autenticado na conta dona do projeto; `neonctl` instalado (8.10.1);
  `curl`; `node` e `npm ci` feito na raiz (o `qa-db-password.sh` confere a credencial
  com o `@prisma/client` do repo). Rodar na raiz do repositório.
- **Nunca resete a `qa` pelo painel do Neon**: além de pular o rekey, o reset pelo
  painel devolve à `qa` a senha de Produção. Se acontecer, rode o `qa-reset.sh` (ou ao
  menos o `qa-db-password.sh`).
- **Chave da API do Neon** (`NEON_API_KEY`): o script exige essa variável, mesmo com o
  `neonctl` já logado. Crie uma chave no console do Neon (*Account settings → API
  keys*), de preferência só para este reset, e revogue depois. Não use
  `neonctl api-keys create`, que imprime a chave na tela.

### Carregar `NEON_API_KEY` sem expor

Opção A (Keychain; a chave tem menos de 128 caracteres, então o prompt sem eco não
corta). Numa aba do Terminal.app, uma vez:

```zsh
security add-generic-password -U -a indice -s indice-neon-api-key -w
# cola a chave duas vezes (sem eco); depois limpe o clipboard: pbcopy </dev/null
```

Opção B (só nesta sessão do terminal, sem eco):

```zsh
read -rs 'NEON_API_KEY?Chave da API do Neon: '; print; export NEON_API_KEY
```

Variáveis que o `qa-reset.sh` lê:

| Variável | Obrigatória | Valor |
|---|---|---|
| `NEON_API_KEY` | sim | segredo (acima) |
| `NEON_PROJECT_ID` | sim | id do projeto Neon do Índice (não é segredo; `neonctl projects list --org-id <org>`) |
| `NEON_BRANCH` | não | só aceita `qa` (qualquer outro valor aborta) |
| `PROJECT_ID` | não | padrão `indice-509203` |
| `REGION` | não | padrão `southamerica-east1` |

## 2. Antes do reset (leituras)

- Horário de início (UTC) e metadados da branch `qa` (só metadados):

  ```zsh
  print "inicio=$(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee ~/indice-wp04-provas/18-antes.txt
  neonctl branches get qa --project-id "$NEON_PROJECT_ID" --output json </dev/null \
    | python3 -I -c 'import json,sys; d=json.load(sys.stdin); d=d.get("branch",d); print({k:d.get(k) for k in ("id","name","parent_id","parent_timestamp","last_reset_at")})' \
    | tee -a ~/indice-wp04-provas/18-antes.txt
  ```
  Antes do primeiro reset: `parent_id` = id da principal e `last_reset_at=None`.
- **Guarda de Produção**: revisão/imagem de `indice-api` e `indice-web`;
  `count(*)` de `_prisma_migrations`, `User` e `Habit` da principal (só números).
- **Contagens de QA**: `count(*)` de `User`, `Habit`, `ApiKey` e o ledger
  (`_prisma_migrations`).

  As contagens saem de um script node com o `@prisma/client` do repositório
  (`node_modules/@prisma/client`), com `DATABASE_URL=$(neonctl cs <branch> --project-id
  "$NEON_PROJECT_ID")` só no ambiente do processo, imprimindo só números e nomes de
  migração (mesmo padrão do `17-guarda-*`):

  ```js
  // conta.cjs — só leitura; argv[2] = caminho do @prisma/client
  const { PrismaClient } = require(process.argv[2]); const db = new PrismaClient();
  (async () => {
    const q = async (t) => (await db.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}"`))[0].n;
    const m = await db.$queryRawUnsafe('SELECT migration_name, (finished_at IS NULL AND rolled_back_at IS NULL) AS pendente, (rolled_back_at IS NOT NULL) AS rb FROM _prisma_migrations ORDER BY started_at');
    console.log(`User=${await q('User')} Habit=${await q('Habit')} ApiKey=${await q('ApiKey')} migracoes=${m.map(r => r.migration_name + (r.pendente ? '[PENDENTE]' : r.rb ? '[rolled_back]' : '')).join(',')}`);
    await db.$disconnect();
  })().catch(e => { console.error('erro:', e.code || e.name); process.exit(1); });
  ```
  ```zsh
  for b in production qa; do
    print "$b $(DATABASE_URL=$(neonctl cs $b --project-id "$NEON_PROJECT_ID" </dev/null 2>/dev/null) node conta.cjs ~/Documents/GitHub/indice/node_modules/@prisma/client)"
  done | tee -a ~/indice-wp04-provas/18-antes.txt
  ```

## 3. O reset (usuário)

Na raiz do repositório, no terminal do usuário:

```zsh
# com a opção A (Keychain); a chave vai só para o ambiente do script, não para argv nem histórico
export NEON_PROJECT_ID='<id do projeto Neon>'   # não é segredo
NEON_API_KEY=$(security find-generic-password -a indice -s indice-neon-api-key -w) \
infra/cloudrun/qa-reset.sh
# com a opção B (já exportada na sessão)
infra/cloudrun/qa-reset.sh
```

- O script confere os pré-requisitos (imagem de `indice-api-qa`, jobs
  `indice-migrate-qa`, `indice-seed-qa`, `indice-rekey-qa`) e pergunta:
  `Isto apaga os dados da branch Neon "qa" e copia os da Produção. Digite qa para continuar:`
  → digite `qa`. Qualquer outra resposta cancela sem mudar nada.
- **Muda em QA:** a branch Neon `qa` volta a ser cópia da principal de agora (dados e
  ledger de migrações); logo depois do reset, `qa-db-password.sh` troca a senha do
  `neondb_owner` só na `qa`, grava versão nova dos 2 secrets de QA, confere (senha ≠
  Produção; host de QA aceita; host de Produção recusa), destrói as versões antigas e
  cria revisão nova de `indice-api-qa` (cada etapa imprime `ok`); `indice-seed-qa` e `indice-rekey-qa` passam para a imagem
  atual de `indice-api-qa`; executa `indice-migrate-qa` → `indice-seed-qa` →
  `indice-rekey-qa`, nessa ordem; `/health` de QA.
- **Não toca:** a branch principal (o reset é da branch `qa`, a partir da mãe; a
  principal não tem mãe, então `reset --parent` nela falharia), serviços e jobs de
  Produção, imagens. Os secrets de banco de QA ganham uma versão nova (a única
  ativa); `indice-qa-api-key` não muda. O script recusa `NEON_BRANCH`
  diferente de `qa`. O reset mantém a branch e o compute, então o host dos secrets `indice-qa-database-url*` não muda; a senha muda (é o objetivo do `qa-db-password.sh`).
- Durante o reset o compute da `qa` reinicia: QA fica fora do ar por alguns segundos
  a minutos.

## 4. Depois do reset (sinais de sucesso)

| Sinal | Esperado |
|---|---|
| Script | termina sem erro, imprime o `/health` e "QA recopiada" |
| `qa-db-password.sh` | todas as linhas `ok`, terminando em `qa-db-password: ok` (senha ≠ Produção; host de Produção recusa) |
| Secrets de banco de QA | uma única versão não destruída em cada um, a nova (`gcloud secrets versions list <secret> --filter='state!=DESTROYED'`); as anteriores DESTROYED |
| Critério novo (spec, conferência independente) | Ahsoka compara em memória, sem imprimir, a senha de cada secret de QA com a da principal (`neonctl cs production`): `mesma_senha=nao` nos dois |
| `neonctl branches get qa` | `last_reset_at` posterior ao `inicio` do item 2; `parent_id` ainda a principal |
| Ledger de QA | `init` + `aceite_002_noop` aplicadas; sem `[PENDENTE]`; a `aceite_002_falha` some (a principal não a tem) |
| `ApiKey` em QA | exatamente 1 (só a de QA, depois do rekey) |
| `User` e `Habit` | QA == Produção (mesmo instante; o seed só faz upsert do usuário existente) |
| Chaves cruzadas | QA+chave QA=200, QA+chave Prod=401, Prod+chave Prod=200, Prod+chave QA=401 |
| `/habits/today` | QA (chave QA) e Prod (chave Prod) com HTTP 200 e o mesmo `length` da resposta, no mesmo dia |
| `/health` QA | 200 |
| Web de QA | `gcloud run services proxy indice-web-qa --region southamerica-east1 --port 3100` e abrir `http://127.0.0.1:3100`: carrega com dados; anônimo continua 403 |
| Guarda de Produção | igual à de antes (revisões, migrações, `User`, `Habit`) |

Chaves cruzadas e `length`, sem eco (a chave vai do Secret Manager para o `curl` por stdin):

```zsh
R=southamerica-east1
API_QA=$(gcloud run services describe indice-api-qa --region $R --format='value(status.url)')
API_PROD=$(gcloud run services describe indice-api --region $R --format='value(status.url)')
s() { gcloud secrets versions access latest --secret "$2" | awk '{ printf "X-Api-Key: %s\n", $0 }' \
      | curl -s -o /dev/null -w "%{http_code}  $1  chave=$2\n" -H @- "$1/habits/today"; }
len() { gcloud secrets versions access latest --secret "$2" | awk '{ printf "X-Api-Key: %s\n", $0 }' \
        | curl -s -H @- "$1/habits/today" | wc -c | tr -d ' '; }
{ s $API_QA indice-qa-api-key; s $API_QA indice-api-key; s $API_PROD indice-api-key; s $API_PROD indice-qa-api-key
  print "length_qa=$(len $API_QA indice-qa-api-key) length_prod=$(len $API_PROD indice-api-key)"
} | tee ~/indice-wp04-provas/18-depois-chaves.txt
```

## 5. Se algo falhar

- **Antes da confirmação** (pré-requisito, variável faltando): nada mudou; corrija e
  rode de novo.
- **No `neonctl branches reset`**: QA pode estar sem compute por alguns minutos; confira
  `neonctl branches get qa`. Rodar o script de novo é seguro (o reset é idempotente:
  recopia a principal outra vez).
- **No `qa-db-password.sh`**: a `qa` pode estar com senha nova e os secrets ainda com a
  antiga (QA não conecta, mas nada vaza). Rode o `qa-reset.sh` de novo, ou só o
  `qa-db-password.sh` seguido dos jobs migrate → seed → rekey. Se ele parar em "host de
  Produção não recusou", **pare e avise**: as versões antigas não foram destruídas.
  `INCOMPLETO: ...` (disable, destroy ou revisão) = a senha nova já vale, mas falta
  limpeza; rode de novo (é idempotente). O estado residual de cada caso está no README
  (seção "Senha de banco própria de QA").
- **Em `indice-migrate-qa`, `indice-seed-qa` ou `indice-rekey-qa`**: a `qa` já foi
  recopiada. **Não use QA** até rodar o script de novo até o fim: sem o rekey, a chave
  de Produção abre QA (risco descrito no README). Rodar de novo refaz tudo na ordem
  certa.
- **`/health` diferente de 200 ou web de QA fora do ar**: veja a última revisão
  (`gcloud run services describe indice-api-qa`) e os logs; o reset não muda a
  revisão. Se o compute da `qa` estiver suspenso, a primeira chamada acorda (pode
  levar segundos).
- Qualquer diferença na guarda de Produção: parar e abrir bloqueio.
- Depois: `unset NEON_API_KEY` (opção B) ou
  `security delete-generic-password -a indice -s indice-neon-api-key` (opção A), e
  revogar a chave no console do Neon.

## Chave de QA, APK e proxy

A senha de **banco** de QA muda a cada reset (é o objetivo do `qa-db-password.sh`), mas
fica só nos secrets; nada no APK nem na web depende dela.

O reset **não muda a chave de QA**: ela é o valor `latest` do secret
`indice-qa-api-key`, que o reset não toca. O seed registra o hash dessa mesma chave e o
rekey só apaga as outras (incluindo a de Produção, que volta com a cópia). APK de QA,
web de QA (o secret é lido na subida da revisão) e proxy continuam funcionando sem
mudança. A chave só muda se alguém adicionar uma versão nova ao secret (rotação,
descrita no README).
