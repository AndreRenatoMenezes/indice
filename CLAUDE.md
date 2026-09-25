# Índice — guia para agentes

Monorepo npm workspaces + Turborepo. Node 24. Sem pnpm.

- **API** (`apps/api`): Fastify 5, TypeScript ESM (`NodeNext`, imports com `.js`), Prisma 6, zod 4. Regras de negócio são módulos puros em `src/modules/**` com testes vitest ao lado. Rotas em `src/routes/**`, uma por módulo de negócio. Auth: `X-Api-Key` resolve `req.userId`; toda query filtra por ele.
- **Web** (`apps/web`): Next.js 15 App Router, Server Components + Server Actions. O browser nunca chama a API; `lib/api.ts` roda no servidor com a chave em env.
- **Android** (`apps/android`): Kotlin, Compose, Retrofit + kotlinx.serialization. DTOs em `data/api/Dto.kt` espelham `packages/shared`. Telas em `ui/<aba>/` com `LoadViewModel` (`ui/common`); `IndiceRepository` é a única porta para a API. Build por CLI: `JAVA_HOME` = JBR do Android Studio (ou JDK 17+), `./gradlew :app:assembleDebug`.
- **DB** (`packages/db`): schema Prisma. Meses 1..12. Dinheiro `Decimal(14,2)`. Soft delete por `deletedAt`. Saldos nunca gravados, sempre derivados. O seed é `src/seed.ts` (compilado, roda como job no Cloud Run).
- **Contratos** (`packages/shared`): zod. Mudou um DTO? Atualize também o `Dto.kt`.

Os dois pacotes publicam `dist/` (`main`/`types` apontam para lá), nunca o `.ts` fonte — senão a API compilada não sobe fora do `tsx`. Por isso `test`, `typecheck` e `dev` dependem de `^build` no `turbo.json`; em dev os pacotes rodam `tsc --watch`.

Comandos: `npm run dev | test | typecheck | build`, `npm run db:migrate -- --name x`, `npm run db:deploy`, `npm run db:seed`. O `.env` da raiz é carregado por `packages/db/src/env.ts` (API, seed); `POSTGRES_PORT` muda a porta do compose.

Decisões e mapeamento do legado em `docs/analise-legado.md`. Não reintroduzir Supabase nem Telegram.

Features novas têm spec em `.claude/specs/` (fluxo spec-driven); o banco documentado para specs fica em `.claude/specs/schema.md`.

**Definição de Pronto (vale para toda WP):**
- `npm run typecheck`, `npm run test` e `npm run build` passam (é o que o CI roda).
- Regra de negócio nova vira módulo puro em `apps/api/src/modules/**` com teste vitest ao lado.
- Mudou contrato em `packages/shared` → `Dto.kt` atualizado. Tocou o Android → `./gradlew :app:assembleDebug` passa.
- Mudou o banco → migração versionada e `.claude/specs/schema.md` atualizados no mesmo commit.
