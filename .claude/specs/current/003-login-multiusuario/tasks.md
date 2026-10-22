# Tasks — 003-login-multiusuario

Contrato: `spec.md` e `plan.md` desta pasta. Handoff de git: Chewie. Reviewer: Ahsoka.

Ondas: 1 = WP01 + WP02 · 2 = WP03 + WP05 + WP06 (WP04 logo após a WP03 do Rex) · 3 = WP07.

### WP01 — Spike e provisionamento do Neon Auth
- Lane: planejado
- Dono: Obi
- Possui: `.claude/specs/current/003-login-multiusuario/spike-neon-auth.md` (novo); console/API Neon (autorizado pelo usuário em 2026-10-22: habilitar Auth na principal e na branch `dev`)
- Fora de escopo: todo código em `apps/**` e `packages/**` (Rex, Android), `infra/**` e `.github/**` (WP06)
- Objetivo: provar o protocolo servidor a servidor do Neon Auth e deixar Auth habilitado com a config do plano.
- Aceite: o "Gate da WP01" do `plan.md` inteiro, com registro sem token nem senha no `spike-neon-auth.md`; nomes de endpoint, formato do cookie, tamanho do código e parâmetro do link de reset documentados.
- Evidência: `spike-neon-auth.md` + lista dos comandos (sem segredo).
- Depende de: —

### WP02 — Contratos e migração
- Lane: revisão
- Dono: Rex
- Possui: `packages/shared/src/index.ts`, `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/<ts>_user_auth_user_id/`, `.claude/specs/schema.md` (Rex aplica o texto do delta do `plan.md`, sem redesenhar o schema)
- Fora de escopo: `apps/**`
- Objetivo: DTOs de auth no shared e `User.authUserId` com migração aditiva.
- Aceite: `npm run typecheck` e `npm run build` passam; migração expand-only; `schema.md` atualizado no mesmo commit.
- Evidência: saída dos comandos e diff.
- Depende de: —
- Log:
  - 2026-10-22: Bloco Auth adicionado em `packages/shared/src/index.ts` conforme `plan.md`.
  - 2026-10-22: Campo `User.authUserId String? @unique` adicionado em `packages/db/prisma/schema.prisma`.
  - 2026-10-22: Migração manual aditiva `20261022203000_user_auth_user_id/migration.sql` criada (sem banco local ativo / credencial de `.env` rotacionada).
  - 2026-10-22: `.claude/specs/schema.md` atualizado com o campo `USER.authUserId`, regra de vínculo e histórico de migrações.
  - 2026-10-22: Comandos `npm run typecheck`, `npm run test` e `npm run build` executados com sucesso. Handoff para revisão da Ahsoka via Luke.
  - 2026-10-22: Revisão da Ahsoka: aprovado. DTOs de Auth idênticos ao plan.md; migração 20261022203000_user_auth_user_id expand-only (coluna nullable e índice único); schema.md com delta exato (campo, regra, histórico); paths respeitam escopo da WP02 (apps/** intocado; Dto.kt atribuído à WP05); sem segredos; npm run typecheck, test e build executados com sucesso (código 0). Veredito entregue ao Luke.

### WP03 — API
- Lane: planejado
- Dono: Rex
- Possui: `apps/api/package.json`, `apps/api/src/config.ts`, `apps/api/src/plugins/auth.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/modules/auth/**`, `apps/api/src/lib/neon-auth-client.ts`
- Fora de escopo: `apps/web/**`, `apps/android/**`, `infra/**`
- Objetivo: fachada `/auth/*`, `/me`, verificação de JWT, allowlist e identidade conforme o plano.
- Aceite: critérios de "Dados e acesso" da spec cobertos por vitest; `npm run typecheck|test|build` passam.
- Evidência: saída dos comandos; testes listados por critério.
- Depende de: WP01, WP02

### WP04 — Web
- Lane: planejado
- Dono: Rex
- Possui: `apps/web/middleware.ts`, `apps/web/lib/{session,api,actions}.ts`, `apps/web/app/{entrar,criar-conta,verificar-email,esqueci-senha,redefinir-senha}/**`, componente do Nav
- Fora de escopo: `apps/api/**`, `apps/android/**`, `infra/**`
- Objetivo: telas e sessão por cookies com renovação no middleware.
- Aceite: critérios "Web" da spec; `npm run typecheck|test|build` passam.
- Evidência: saída dos comandos; capturas em `.claude/specs/current/003-login-multiusuario/capturas/`.
- Depende de: WP03 (pode começar contra a API local assim que a WP02 fechar)

### WP05 — Android
- Lane: revisão
- Dono: Engineer Android (a recrutar)
- Possui: `apps/android/**`
- Fora de escopo: `apps/api/**`, `apps/web/**`, `packages/**`
- Objetivo: telas de entrada, SessionStore, Authenticator, widget deslogado, sem chave embutida.
- Aceite: critérios "Android" da spec; `./gradlew :app:assembleDebug` passa; `Dto.kt` espelha o shared.
- Evidência: saída do build e diff.
- Depende de: WP02 (contrato); prova final com a WP03
- Log:
  - 2026-10-22 · Engineer Android · implementado em `apps/android/**`: `SessionStore` (DataStore), `AuthAuthenticator` (mutex, retry único, 401 no refresh limpa a sessão), Interceptor Bearer (pula `/auth/*`), telas Entrar/Criar conta/Código/Esqueci a senha, "Acesso removido" (403 com sessão), navegação por estado de sessão com ViewModels por sessão, "Sair" no cabeçalho de Hoje, widget "Entre no app", sem `API_KEY` no BuildConfig, `allowBackup=false`. `./gradlew :app:assembleDebug` passa. Fluxo contra a API real pendente (WP03).
  - 2026-10-22 · Revisão da Ahsoka: aprovado por diff e build. `./gradlew :app:assembleDebug --rerun-tasks` BUILD SUCCESSFUL (app-debug.apk 13 MB); grep sem `API_KEY`/`X-Api-Key`/`dev-local-key` em `apps/android` (fora de `build/`); `allowBackup="false"`; `Dto.kt` espelha o bloco Auth do shared; `AuthAuthenticator` com Mutex, checagem de token já renovado e retry único (`priorResponse`), client de refresh sem authenticator; widget deslogado "Entre no app"; telas Entrar/Criar conta/Código/Esqueci/Acesso removido. Pendente: fluxo manual no Pixel 10 após a WP03. Riscos anotados: sign-in com e-mail não verificado reenvia código sozinho (fora do plan), "Sair" só na aba Hoje, refresh só reativo ao 401 (sem refresh por `exp`).

### WP06 — Infra
- Lane: planejado
- Dono: Obi
- Possui: `infra/cloudrun/{cloudbuild.yaml,bootstrap.sh,qa-reset.sh,README.md}`, `.github/workflows/deploy.yml`
- Fora de escopo: `apps/**`, `packages/**`
- Objetivo: env/secrets de auth, qa-reset reaplicando a config de QA, README de allowlist e rotação.
- Aceite: critérios "Ambientes" da spec; scripts idempotentes; nenhum e-mail ou segredo no repositório.
- Evidência: diff e prova do `qa-reset` quando autorizado.
- Depende de: WP01

### WP07 — Aceite em QA e promoção
- Lane: planejado
- Dono: Ahsoka (validação), Obi (passos de Produção)
- Possui: nenhum arquivo de código
- Fora de escopo: tudo que for código
- Objetivo: validar todos os critérios da spec em QA e, com autorização do usuário, promover.
- Aceite: todos os critérios da spec com evidência independente.
- Evidência: relatório da Ahsoka.
- Depende de: WP03–WP06 mergeadas em `development`
