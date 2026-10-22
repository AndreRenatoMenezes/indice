# Tasks concluídas — 003-login-multiusuario

Aprovadas pela Ahsoka em 2026-10-22. Commits locais em `feat/003-login-multiusuario`: WP02 `757fbab`, WP05 `cac41fc`. O fluxo manual no Pixel 10 da WP05 fica na WP07.

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


### WP04 — Web
- Lane: revisão
- Dono: Rex
- Possui: `apps/web/middleware.ts`, `apps/web/lib/{session,api,actions}.ts`, `apps/web/app/{entrar,criar-conta,verificar-email,esqueci-senha,redefinir-senha}/**`, componente do Nav
- Fora de escopo: `apps/api/**`, `apps/android/**`, `infra/**`
- Objetivo: telas e sessão por cookies com renovação no middleware.
- Aceite: critérios "Web" da spec; `npm run typecheck|test|build` passam.
- Evidência: saída dos comandos; capturas em `.claude/specs/current/003-login-multiusuario/capturas/`.
- Depende de: WP03 (pode começar contra a API local assim que a WP02 fechar)
- Log:
  - 2026-10-22 · Rex · implementado: `lib/session.ts` (cookies httpOnly `indice_rt`/`indice_at`, `Secure` em produção, `SameSite=Lax`, `path=/`, `maxAge` pelo `exp`; sign-in/refresh/sign-out e demais `/auth/*`); `lib/api.ts` com `Authorization: Bearer` e fallback `dev-local-key` só fora de produção (produção não lê mais `INDICE_API_KEY_WEB`), redirect em 401 e em 403 `not allowed`; `middleware.ts` renova com 60 s de folga e repassa o token ao request e ao navegador, 401 limpa os cookies; actions de entrar/criar/verificar/reenviar/esqueci/redefinir/sair com erros por `?erro=`; páginas `entrar`, `criar-conta`, `verificar-email`, `esqueci-senha`, `redefinir-senha` e `entrar/acesso-removido`; Nav ganha Sair e some nas telas de auth.
  - 2026-10-22 · Rex · emenda 003: sign-in 403 `email not verified` chama `/auth/resend-verification` e abre `/verificar-email?email=`; 403 `not allowed` leva à tela de acesso removido com Sair. Cadastro e verificação seguem o contrato: `verify-email` responde 204 sem sessão, então a entrada pede a senha depois do código.
  - 2026-10-22 · Rex · ajustes mínimos fora da lista de paths para o cliente virar server-only: `dateBR` passou para `lib/dates.ts` e 3 componentes client passaram a importá-lo de lá; `unstable_rethrow` nos dois catches (`app/page.tsx`, `app/semana/page.tsx`) para o redirect de 401/403 não ser engolido. Nada em `apps/api/**`.
  - 2026-10-22 · Rex · ressalva de segurança da revisão: `safeNext` saiu para `lib/safe-next.ts` (função pura) e rejeita barra invertida crua e `%5C`; resolve com `new URL(next, origem)` e compara a origem; barra `//`, `/\`, tabs/newlines e a normalização de `/..//host`; `?next` inválido cai em `/` e `/entrar*` também. Teste `lib/safe-next.test.ts` com 7 casos; `apps/web/package.json` ganhou `test: vitest run` + vitest (o lock foi sincronizado e também levou o `jose` que faltava da WP03). Gates: typecheck 7/7, test 154 (147 API + 7 web), build 5/5.
  - 2026-10-22 · Rex · decisão da Leia (plan.md, "Web: sessão"): `indice_rt` com `maxAge` de 7 dias no sign-in e regravado com mais 7 dias a cada refresh bem-sucedido no middleware (janela deslizante); `indice_at` segue até o `exp`. Middleware também tolera 2xx sem JSON em vez de estourar 500. Provas locais: sign-in `indice_rt Max-Age=604800` / `indice_at Max-Age=899`; refresh 200 regrava `indice_rt Max-Age=604800` e `indice_at` novo; refresh 401 limpa os dois e 307 para `/entrar`. Gates finais: typecheck 7/7, test 154 (147 API + 7 web), build 5/5.
  - 2026-10-22 · Rex · provas locais com API falsa: login grava os dois cookies; senha errada → `?erro=credenciais`; não verificado → resend + `/verificar-email`; fora da lista → `?erro=nao-autorizado`; refresh com access vencido regrava `indice_at` e a página usa o token novo; refresh 401 limpa cookies e volta a `/entrar`; 403 da API → `/entrar/acesso-removido`; 401 → `/entrar`; Sair chama `/auth/sign-out`, apaga os cookies e volta a `/entrar`.
  - 2026-10-22 · Rex · gates: `npm run typecheck` (7/7), `npm run test` (146/146) e `npm run build` (5/5), código 0. Sem stage/commit (Chewie). Capturas em `capturas/` ficam para o aceite da Ahsoka.

