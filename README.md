# Índice

Mapa central minimalista, inspirado no Bullet Journal: rotina (bullets, hábitos),
saúde financeira, metas de longo prazo e arquivo de mídia, num único ambiente
sob controle próprio. API-first, pronto para Google Cloud Run + Cloud SQL.

```
apps/api       Fastify + TypeScript + Prisma  → Cloud Run
apps/web       Next.js (App Router)           → Cloud Run
apps/android   Kotlin + Jetpack Compose + Retrofit (+ widget Glance)
packages/db    Schema Prisma, cliente e seed
packages/shared Contratos zod compartilhados (API ↔ Web; espelhados no Android)
infra/cloudrun Cloud Build + guia de deploy
docs/          Análise do legado e decisões
```

## Rodando local

```bash
cp .env.example .env
docker compose up -d postgres          # ou qualquer Postgres em DATABASE_URL
npm install
npm run db:generate
npm run db:deploy                      # aplica as migrações versionadas
npm run db:seed                        # usuário, categorias, hábitos, meta
npm run dev                            # api :8080 · web :3000
```

Chave de dev: `X-Api-Key: dev-local-key` (ver `.env.example`). O `.env` da raiz é
lido pela API, pelo seed e pela CLI do Prisma; se a porta 5432 já estiver em uso,
defina `POSTGRES_PORT=5433` no `.env` e ajuste `DATABASE_URL` (o compose respeita
a variável).

### Android

```bash
cd apps/android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"   # ou qualquer JDK 17+
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

No emulador a API do host é `http://10.0.2.2:8080/` (já é o padrão em
`app/build.gradle.kts`). Abas: Hoje · Hábitos · Financeiro (+ lançamento rápido) ·
Metas · Mídia, mais o widget de hábitos. Veja [apps/android/README.md](apps/android/README.md).

```bash
curl -H 'X-Api-Key: dev-local-key' 'http://localhost:8080/daily-summary'
```

## Endpoints principais

| Rota | Papel |
|---|---|
| `GET /daily-summary?date=`, `PUT /daily-log/:date` | Visão diária unificada: bullets, hábitos, finanças, metas, mídia; reflexão do dia |
| `GET/POST /entries`, `PATCH/DELETE /entries/:id`, `POST /entries/:id/move`, `POST /entries/:id/migrate`, `POST /entries/:id/duplicate`, `POST /entries/batch` | Bullets (tarefa/evento/nota, subtarefas em árvore): mover entre dias e listas (sair de um dia deixa o rastro ›), reordenar, duplicar e ações em lote (concluir, migrar, apagar, restaurar) |
| `GET/POST /lists`, `PATCH/DELETE /lists/:id`, `PUT /lists/order` | Listas personalizadas da semana ("Algum dia", "Projetos"), com as tarefas de cada uma |
| `GET /recurrence-rules`, `PUT /entries/:id/recurrence`, `DELETE /recurrence-rules/:id` | Tarefas repetidas: a regra nasce de uma tarefa de um dia; as ocorrências aparecem ao ler um dia ou intervalo, de hoje em diante; parar apaga as futuras abertas |
| `GET/POST /habits`, `GET /habits/today`, `PUT/DELETE /habits/:id/log` | Hábitos com régua semanal, sequência e consistência de 30 dias; marcação rápida idempotente por dia (valor omitido = meta atingida) |
| `GET /finance/summary`, `GET/POST/DELETE /transactions`, `GET/POST /accounts`, `GET /categories`, `GET/POST /institutions`, `POST /institutions/:id/cards`, `GET /invoices`, `POST /invoices/:id/pay` | Financeiro (regras portadas do app-financeiro): compra no crédito cai na fatura do ciclo, conta só move ao pagar |
| `GET/POST /goals`, `GET/PATCH /goals/:id`, `POST /goals/:id/contributions`, `POST /goals/:id/snapshot`, `GET /goals/:id/export?format=csv` | Metas, aportes, ajuste de alvo/status e export para modelagem |
| `GET/POST /media`, `GET/PATCH /media/:id`, `POST /media/:id/notes`, `POST /media/:id/sessions` | Arquivo de mídia |

## Testes e verificação

```bash
npm run test        # regras de negócio portadas (ciclo de fatura, parcelas, saldo, assinaturas, metas)
npm run typecheck
```

Ver [docs/analise-legado.md](docs/analise-legado.md) para o mapeamento do legado
e [infra/cloudrun/README.md](infra/cloudrun/README.md) para o deploy.
