# Rotação da senha do banco de Produção

Status: **preparado, não executado.** A execução exige nova autorização explícita
do usuário (decisoes.md, 2026-10-22). Nada aqui foi rodado contra a nuvem.

Motivo: versões antigas de `docs/deploy-manual.md` (commit 0a41786, 2026-09-20)
publicaram, em repositório público, a senha atual do papel `neondb_owner` da
branch Neon `production`. O arquivo já não a contém, mas o histórico sim e não
será reescrito. O remédio é trocar a senha.

Ferramenta: `infra/cloudrun/prod-db-password.sh` (mesma linha do
`qa-db-password.sh`: senha só em variáveis do shell, nada em argv, stdout ou
arquivo; imprime só `ok`/`falhou`/`INCOMPLETO`/`RECUPERAÇÃO`).

Regra dos GATES: binários. Resultado diferente do esperado = **parar** e reportar
ao Luke. Nenhum comando abaixo imprime senha; se algum imprimir, pare e trate como
novo vazamento.

## 1. Levantamento feito no repositório (sem nuvem)

| Item | Valor |
|---|---|
| Papel e branch | `neondb_owner`, branch `production` (padrão do projeto Neon) |
| Secret do pooler | `indice-database-url` (URL `-pooler`, `pgbouncer=true`) |
| Secret direto | `indice-database-url-direct` |
| `indice-api` | `DATABASE_URL=indice-database-url:latest` (cloudbuild.yaml, passo deploy-api) |
| `indice-migrate` | `DATABASE_URL=indice-database-url-direct:latest` (cloudbuild.yaml, passo migrate) |
| `indice-seed` | `DATABASE_URL=indice-database-url-direct:latest`, `INDICE_API_KEY=indice-api-key:latest` (README, seção 4) |
| `indice-web` | só `INDICE_API_KEY_WEB=indice-api-key:latest`; **não lê o banco**, não é afetada |
| GitHub Actions | `deploy.yml` usa só `vars.GCP_PROJECT_ID`, `vars.GCP_WIF_PROVIDER`, `vars.GCP_DEPLOY_SA` e passa **nomes** de secret ao Cloud Build; nenhum `secrets.*`. `ci.yml` usa só o Postgres local do job (`indice:indice@localhost`) |
| QA | secrets próprios (`indice-qa-database-url*`), senha própria na branch `qa` desde o `qa-db-password.sh`; Ahsoka confirmou que difere da de Produção |

Como as referências são `latest`, a versão nova vale para toda instância ou
execução que **inicia** depois de gravada, em qualquer revisão. Instâncias já
quentes guardam a senha antiga no ambiente; daí a revisão nova da `indice-api`.

## 2. GATES antes (só leitura; o usuário roda no próprio terminal)

Preparação do terminal (valores digitados sem eco, nunca colados no chat):

```bash
cd /Users/andre/Documents/GitHub/indice && npm ci
gcloud auth list --filter=status:ACTIVE --format='value(account)'   # conta com acesso ao projeto
gcloud config set project indice-509203
read -rs NEON_API_KEY && export NEON_API_KEY
read -r NEON_PROJECT_ID && export NEON_PROJECT_ID
REGION=southamerica-east1
```

**G1. Branches Neon.** Esperado: exatamente `production default=True` e
`qa default=False`. Qualquer outra branch herdou a senha vazada e seguiria
aceitando-a no próprio host: parar e decidir (apagar ou rotacionar também).

```bash
neonctl branches list --project-id "$NEON_PROJECT_ID" --output json </dev/null \
  | python3 -I -c 'import json,sys; d=json.load(sys.stdin); d=d.get("branches",d) if isinstance(d,dict) else d; [print(x["name"],"default=%s"%bool(x.get("default"))) for x in d]'
```

**G2. Versões dos secrets (nomes, números e estado; sem valores).** Anote os
números. Esperado: ao menos uma versão `ENABLED` em cada um.

```bash
for s in indice-database-url indice-database-url-direct; do
  echo "== $s"; gcloud secrets versions list "$s" --format='table(name.basename(),state,createTime)'
done
```

**G3. Consumidores exatos, em `latest`.** Esperado, e nada além: `indice-api`
com `indice-database-url:latest`; `indice-migrate` e `indice-seed` com
`indice-database-url-direct:latest`; `indice-web` sem nenhum dos dois; nenhum
outro serviço/job da região citando esses secrets. Consumidor faltando, a mais,
com o secret trocado ou em versão numérica = parar. O script exige o mesmo
mapeamento exato e aborta com `falhou:` antes de qualquer escrita.

```bash
for t in services jobs; do for n in $(gcloud run $t list --region $REGION --format='value(metadata.name)'); do
  printf '%s/%s: ' $t $n
  gcloud run $t describe $n --region $REGION --format=json | python3 -I -c '
import json,sys
o=set()
def a(n):
  if isinstance(n,dict):
    r=n.get("secretKeyRef")
    if isinstance(r,dict): o.add("%s:%s"%(r.get("name"),r.get("key")))
    [a(v) for v in n.values()]
  elif isinstance(n,list): [a(v) for v in n]
a(json.load(sys.stdin)); print(" ".join(sorted(o)) or "-")'
done; done
```

**G4. CI não guarda a senha.** Esperado: `gh secret list` sem nenhum secret de
banco (idealmente vazio); `gh variable list` só com `GCP_PROJECT_ID`,
`GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`; `git grep` vazio.

```bash
gh secret list; gh secret list --env production; gh secret list --env qa
gh variable list
git grep -n 'secrets\.' -- .github/workflows
```

**G5. Sem deploy em curso.** Esperado: nenhuma execução `deploy.yml` em andamento
ou aguardando aprovação em `main` (um deploy no meio roda migrate e cria revisão
concorrente). Conferir em *Actions*. Não aprovar deploy de Produção até o fim.

**G6. Janela combinada.** O usuário aceita: alguns segundos sem conexão nova ao
banco (entre os passos 1 e 2 do script) e, possivelmente, queda das conexões
abertas no momento da troca (comportamento do Neon ao trocar senha não está
garantido aqui; trate como janela curta de erros 5xx). Esperado: "ok" do usuário.

**G7. Autorização.** Nova autorização explícita do usuário para executar em
Produção, registrada pelo Luke. Sem ela, parar aqui.

## 3. Execução (um comando)

```bash
infra/cloudrun/prod-db-password.sh
```

Contrato de saída: cada passo bom imprime uma linha terminada em `: ok`.
`falhou: ...` só aparece no passo 0, antes de qualquer escrita, e significa que
**nada** foi trocado. Do passo 1 em diante, toda falha (inclusive erro inesperado
de comando ou Ctrl-C) imprime `INCOMPLETO: <o quê>; rode este script de novo` em
stderr e sai com código != 0; nunca `falhou:`, nunca `ok` no fim.

0. só leitura: G1 e G3 de novo, automáticos (G3 com o mapeamento exato);
   formato dos secrets; senha dos secrets = senha atual do Neon; credencial
   atual conecta; `/health` 200.
1. `reset_password` do `neondb_owner` **só na branch `production`** (API do
   Neon); a senha vai da resposta direto para a variável. Começa a janela e
   começa o regime `INCOMPLETO` (a senha pode ter mudado mesmo com erro na
   resposta).
2. `secrets versions add` nos dois secrets, por stdin. Fecha a janela para
   conexões novas: qualquer instância que inicie a partir daqui lê a senha nova.
3. conferências em memória: `latest` relido = gravado; pooler e direta conectam
   com a senha nova; a senha antiga é recusada por autenticação (P1000).
4. `run services update indice-api --update-labels ...` (revisão nova, mesma
   imagem); revisão pronta, 100% do tráfego, `/health` 200 (o handler roda
   `SELECT 1`).
5. desabilita as versões antigas, depois destrói (até 3 tentativas); sobra só
   a versão nova em cada secret; `/health` 200 de novo; QA lê a própria
   credencial, que difere da nova e conecta.

Esperado no fim: `prod-db-password: ok`.

Os jobs `indice-migrate` e `indice-seed` não precisam de ação: leem `latest` a
cada execução. A `indice-web` não é tocada.

## 4. GATES depois

**D1.** Saída terminou em `prod-db-password: ok`. Senão, ver a tabela da seção 5.

**D2. Versões.** G2 de novo. Esperado: em cada secret, só a versão nova
`ENABLED`; todas as anotadas em G2 `DESTROYED`.

**D3. Senha vazada recusada.** A Ahsoka repete a comparação que fez em
2026-10-22, em memória e sem imprimir: conexão com a credencial vazada no host de
Produção deve falhar com P1000 (authentication failed). Esperado: P1000. Qualquer
`SELECT 1` ok = parar, incidente aberto.

**D4. Ponta a ponta.** Abrir a web de Produção e carregar uma tela com dados
(passa web → API → banco). Esperado: dados carregam.

**D5 (opcional).** Validar o caminho direto por um job:
`gcloud run jobs execute indice-migrate --region $REGION --wait`. Esperado:
sucesso sem migração nova (a imagem é a de Produção). Pular se houver dúvida
sobre a imagem do job.

**D6.** Ambiente local: quem tiver a URL de Produção em `.env` local ou gerenciador
de senhas atualiza (a antiga deixou de funcionar). Encerrar o terminal
(`unset NEON_API_KEY`).

## 5. Falha no meio e plano de volta

Não existe "voltar à senha antiga": ela é pública e o `reset_password` só gera
senha nova. Toda recuperação é para a frente: **rodar o script de novo**.

| Onde parou | Estado | O que fazer |
|---|---|---|
| passo 0 (`falhou:`) | nada mudou | corrigir a causa (G1/G3, auth, `npm ci`) e rodar de novo |
| passo 1 ou 2 (`INCOMPLETO`: `reset_password` ou `versions add` falhou) | Neon possivelmente com senha nova que nenhum secret guarda; Produção **sem conectar** | rodar de novo **já**: o passo 0 detecta `RECUPERAÇÃO` (secrets atrás do Neon), troca outra vez e grava; se a senha não tinha mudado, a rodada segue normal |
| `INCOMPLETO: saída inesperada (código N)` | parou num comando sem mensagem própria, em algum passo de 1 a 5 | rodar de novo; o passo 0 classifica o estado (normal ou `RECUPERAÇÃO`) |
| passo 3 (`INCOMPLETO`) | secrets com senha nova; algo não conferiu | ler a mensagem; se "não conecta", rodar de novo (gera e grava outra); se "senha antiga não foi recusada", **parar**: incidente aberto, chamar Luke |
| passo 4 (`INCOMPLETO`, revisão não ficou pronta) | secrets certos; o Cloud Run segue servindo a revisão anterior (revisão que não fica pronta não recebe tráfego) | ver abaixo |
| passo 5 (`INCOMPLETO`) | rotação feita; sobrou versão antiga não destruída | rodar de novo, ou desabilitar/destruir à mão a versão citada |

Se a API não subir depois da troca:

1. **Reler o secret** em memória e testar: `prod-db-password.sh` de novo faz isso
   e regrava; ou, à mão, conferir o formato
   (`gcloud secrets versions access latest --secret indice-database-url | python3 -I -c 'import sys,urllib.parse as u; p=u.urlparse(sys.stdin.read()); print(p.scheme, p.username, p.hostname, p.path, p.query)'`,
   que imprime tudo menos a senha).
2. **Logs** da revisão nova: `gcloud run services logs read indice-api --region $REGION --limit 50`
   (procurar P1000/P1001; P1000 = senha errada no secret, P1001 = rede/host).
3. **`update-traffic` para a revisão anterior** (`gcloud run services update-traffic indice-api --region $REGION --to-revisions <anterior>=100`)
   só resolve problema **da revisão** (imagem, configuração). Não resolve senha:
   a revisão anterior também lê `latest` ao iniciar instância, então pega a mesma
   senha nova; e a versão antiga do secret, mesmo que ainda existisse (antes do
   passo 5), guarda uma senha que o Neon já recusa. Voltar o tráfego não traz a
   conexão de volta; só um secret com a senha certa traz.
4. Se o Neon e o secret divergirem e o script não resolver, gerar senha pelo
   console do Neon (branch `production`, papel `neondb_owner`, *Reset password*)
   e gravá-la com `read -rs URL && printf '%s' "$URL" | gcloud secrets versions add indice-database-url --data-file=- && unset URL`
   (e o mesmo para o secret direto), depois `gcloud run services update indice-api --region $REGION --update-labels prod-db-password=manual`.

## 6. Impactos

- **QA:** não afetada. A branch `qa` guarda papéis próprios (cópia feita na
  criação/reset) e a senha dela foi trocada pelo `qa-db-password.sh`; a troca na
  `production` não altera a `qa`. O script confere no fim que QA conecta com a
  própria senha. No próximo `qa-reset.sh`, o `reset --parent` copia a senha
  **nova** de Produção para a `qa` e o `qa-db-password.sh` a troca de novo, como
  já faz hoje (ele lê a senha de Produção pelo `neonctl cs production`, sempre a
  atual).
- **CI:** não afetado. GitHub não guarda URL nem senha de banco (G4); o deploy
  passa só nomes de secret e o Cloud Run lê `latest`.
- **Android:** não afetado (fala com a API, nunca com o banco).
- **Web:** não afetada diretamente (sem secret de banco); só sente a janela da API.

## 7. Depois da execução

- Luke registra em `decisoes.md` a rotação feita (data, sem valores) e libera o
  critério 14 da spec.
- `docs/deploy-manual.md` já está sem a credencial (placeholders e aviso); o
  histórico continua com o valor, agora inválido.
