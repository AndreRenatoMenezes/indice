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
npm run db:migrate -- --name init      # cria as tabelas
npm run db:seed                        # usuário, categorias, hábitos, meta
npm run dev                            # api :8080 · web :3000
```

Chave de dev: `X-Api-Key: dev-local-key` (ver `.env.example`).

```bash
curl -H 'X-Api-Key: dev-local-key' 'http://localhost:8080/daily-summary'
```

## Endpoints principais

| Rota | Papel |
|---|---|
| `GET /daily-summary?date=` | Visão diária unificada: bullets, hábitos, finanças, metas, mídia |
| `GET/POST /entries`, `PATCH /entries/:id`, `POST /entries/:id/migrate` | Bullets (tarefa/evento/nota, subtarefas, migração •→>) |
| `GET /habits/today`, `PUT /habits/:id/log` | Hábitos e marcação rápida (idempotente por dia) |
| `GET /finance/summary`, `GET/POST /transactions`, `GET /accounts`, `GET /invoices`, `POST /invoices/:id/pay` | Financeiro (regras portadas do app-financeiro) |
| `GET /goals`, `POST /goals/:id/contributions`, `POST /goals/:id/snapshot`, `GET /goals/:id/export?format=csv` | Metas e export para modelagem |
| `GET/POST /media`, `POST /media/:id/notes`, `POST /media/:id/sessions` | Arquivo de mídia |

## Testes e verificação

```bash
npm run test        # regras de negócio portadas (ciclo de fatura, parcelas, saldo, assinaturas, metas)
npm run typecheck
```

Ver [docs/analise-legado.md](docs/analise-legado.md) para o mapeamento do legado
e [infra/cloudrun/README.md](infra/cloudrun/README.md) para o deploy.
