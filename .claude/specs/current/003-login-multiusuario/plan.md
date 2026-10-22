---
feature: 003-login-multiusuario
status: pronto
criado_em: 2026-10-22
---

# Plano — Login e múltiplos usuários (Neon Auth)

## Estado verificado (2026-10-22)

- O projeto Neon fica na AWS `sa-east-1`, plano Free, sem IP Allow nem Private Networking. O Managed Better Auth é permitido.
- Neon Auth, conforme a doc atual (neon.com/docs/auth, consultada em 2026-10-22):
  - Better Auth 1.7.6 gerenciado. Usuários, sessões e config ficam no schema `neon_auth` de cada branch, e cada branch tem uma Auth URL própria.
  - JWT EdDSA (Ed25519) com validade de 15 minutos e sem claims customizadas. Claims úteis: `sub` (= `neon_auth.user.id`), `email`, `emailVerified`, `iss` e `aud` (= origem da Auth URL). JWKS em `<NEON_AUTH_BASE_URL>/.well-known/jwks.json`.
  - Sessão por token opaco no cookie `__Secure-neonauth.session_token`. JWT via `GET /token` ou pelo header `set-auth-jwt` do `get-session`.
  - **O cadastro é aberto a qualquer pessoa.** O "restricted signups" está no roadmap.
  - O plugin `bearer` não é exposto. Reset de senha só por link, que funciona no SMTP compartilhado. Verificação de e-mail por código também funciona no SMTP compartilhado.
  - Um branch ou reset copia `neon_auth` inteiro: usuários, hashes, config, domínios confiáveis e chaves JWKS. A doc diz que "tokens de um branch não valem em outro" porque o emissor muda.
  - Free: até 60 mil MAU.
- `@neondatabase/auth` 0.7.0-beta tem peer `next >=16`. A web está no Next 15.5.
- A API hoje: `plugins/auth.ts` resolve `req.userId` por `X-Api-Key` ou `Authorization: Bearer <chave>`. A chave `dev-local-key` vale só fora de produção. O rate limit agrupa por chave.
- A web: `lib/api.ts` manda `x-api-key` com `INDICE_API_KEY_WEB`. Não há middleware. O `cloudbuild.yaml` injeta o secret `${_API_KEY_SECRET}` na web.
- O Android: `ApiClient` põe `X-Api-Key` de `BuildConfig.API_KEY`. O release exige `-Pindice.apiKey`. O manifesto tem `allowBackup="true"`. O widget de hábitos usa o mesmo `IndiceRepository`.

## Abordagem

**A API é a fachada de auth.** Web e Android nunca falam com o Neon Auth: chamam `POST /auth/*` da API, que conversa com o Neon Auth servidor a servidor e devolve dois tokens:

- `accessToken`: o JWT do Neon Auth, com 15 minutos.
- `refreshToken`: o token de sessão opaco do Neon Auth. Renova o JWT e encerra a sessão.

As rotas de dados aceitam `Authorization: Bearer <JWT>`, verificado localmente pelo JWKS, e continuam aceitando `X-Api-Key`.

Por que a fachada:
- O protocolo com o Neon Auth (cookie de sessão, `Origin`, nomes de endpoint) fica num lugar só, testável no vitest. Não é duplicado em TypeScript e Kotlin.
- O Android continua com uma única base URL e um único contrato (`IndiceRepository` segue sendo a porta).
- A web segue no Next 15, sem SDK beta.
- A allowlist é aplicada antes de criar a conta, então e-mail fora da lista não chega ao Neon pela nossa interface.

O que a fachada **não** protege: o endpoint público do Neon Auth aceita cadastro direto. Por isso a autorização de verdade está na verificação de cada requisição (allowlist + e-mail verificado), não no cadastro.

## Decisões técnicas

| Tema | Decisão |
|---|---|
| Verificação do JWT | `jose` (`createRemoteJWKSet` + `jwtVerify`), `algorithms: ["EdDSA"]`, `issuer` e `audience` = origem de `NEON_AUTH_BASE_URL`, e `exp`, `sub` e `email` obrigatórios. Emissor errado responde 401: é isso que separa QA de Produção, porque as chaves JWKS são copiadas no reset. |
| Classificação da credencial | `X-Api-Key` vai para ApiKey. `Authorization: Bearer` com três segmentos base64url vai para JWT, e o resto para ApiKey, mantendo a compatibilidade de scripts. Função pura. |
| Identidade | Busca `User` por `authUserId = sub`. Se não achar e `emailVerified` for verdadeiro com o e-mail na allowlist: liga ao `User` de mesmo e-mail (comparação sem caixa) que tenha `authUserId` nulo; senão cria `User` + `UserSettings` vazios. A ligação é atômica (update condicionado a `authUserId IS NULL`), e a corrida perdida relê. |
| Allowlist | `INDICE_ALLOWED_EMAILS`, e-mails separados por vírgula, normalizados com trim e minúsculas, conferida **em toda requisição JWT** pelo e-mail do `User` resolvido. Fora da lista ou não verificado: 403 `{ error: "not allowed" }` ou `{ error: "email not verified" }`. Não vale para ApiKey. |
| Configuração obrigatória | Em `NODE_ENV=production`, a API recusa subir sem `NEON_AUTH_BASE_URL`, `AUTH_WEB_ORIGIN` e `INDICE_ALLOWED_EMAILS`. Fora de produção, sem `NEON_AUTH_BASE_URL`, `/auth/*` responde 503 `{ error: "auth not configured" }` e o caminho JWT fica desligado; `dev-local-key` segue valendo para testes e curl. |
| Chamadas ao Neon Auth | Sempre com `Origin: AUTH_WEB_ORIGIN`. O `refreshToken` repassado é o valor do cookie de sessão, enviado como `Cookie: __Secure-neonauth.session_token=<valor>`. Os nomes exatos dos endpoints e o formato do cookie saem do spike da WP01 e ficam num único módulo (`neon-auth-client.ts`). |
| Rate limit | `/auth/*` com limite próprio por IP: 10 por minuto, fixo no código e sem configuração. As rotas de dados continuam agrupando pela credencial. |
| Web: sessão | Dois cookies `httpOnly`, `Secure` (em produção), `SameSite=Lax`, `path=/`: `indice_rt` (refresh, `maxAge` de 7 dias, regravado com 7 dias a cada renovação bem-sucedida) e `indice_at` (JWT, com `maxAge` até o `exp`). Fechar o navegador não desloga, igual ao Android. Se a sessão do Neon vencer antes, o refresh responde 401 e leva a `/entrar`. Não guardam segredo próprio, então dispensam assinatura. |
| Web: renovação | `middleware.ts` (Next 15). Sem `indice_rt`, redireciona para `/entrar`. Com o `indice_at` vencido ou a menos de 60 s do fim, chama `POST /auth/refresh`, regrava os cookies na resposta e repassa o token novo ao request. Refresh com 401 apaga os cookies e redireciona. Server Components só leem cookie, porque não podem gravá-lo. O matcher exclui `/entrar`, `/criar-conta`, `/verificar-email`, `/esqueci-senha`, `/redefinir-senha`, `/_next` e os estáticos. |
| Web: chamadas | `lib/api.ts` manda `Authorization: Bearer <indice_at>`. Sem token, lança e redireciona para `/entrar`. Em produção não lê mais `INDICE_API_KEY_WEB`. Em dev, sem sessão, cai em `dev-local-key` (como hoje). |
| Android: armazenamento | `refreshToken` e `accessToken` + `exp` em DataStore (`data/auth/SessionStore.kt`). `allowBackup="false"`: não há outro dado local que valha backup. |
| Android: renovação | `Interceptor` põe o Bearer. Um `okhttp3.Authenticator` trata o 401: chama `/auth/refresh` por um client sem authenticator (com mutex, uma renovação por vez) e repete a chamada uma vez. Refresh com 401 limpa a sessão e emite o estado deslogado, e o app volta para a tela de entrada. |
| Reset de senha | `POST /auth/forgot-password` sempre responde 204, para não revelar a existência do e-mail. O Neon Auth envia o link para `${AUTH_WEB_ORIGIN}/redefinir-senha`. O Android dispara o pedido, e o link abre a web. |
| Cadastro com e-mail fora da lista | `POST /auth/sign-up` responde 403 `{ error: "not allowed" }` antes de falar com o Neon. Isso revela se o e-mail está na lista, o que é aceito para um app pessoal: o próprio cadastro do Neon já revela se a conta existe. |
| QA | O Auth é habilitado na branch principal (Produção) **antes** do reset de QA. O `qa-reset.sh` copia `neon_auth`. Depois do reset, o script reaplica a config de QA (domínio confiável `AUTH_WEB_ORIGIN` de QA e Allow Localhost) e confere que a Auth URL de QA não mudou. Os usuários e hashes da Produção ficam em QA, coerente com a decisão 6 da 002 (QA é cópia real). Em QA, `AUTH_WEB_ORIGIN` = `http://127.0.0.1:3100`, a origem do proxy, porque a web de QA só abre por ele. |
| SMTP | O compartilhado do Neon (`auth@mail.myneon.app`), com o nome da aplicação "Índice". O SMTP próprio fica fora de escopo, e o risco está aceito (limite de envio). |

## Contratos

### `packages/shared/src/index.ts` (novo bloco "Auth")

```ts
export const email = z.string().trim().toLowerCase().email();
export const password = z.string().min(8).max(128);

export const SignUpInput = z.object({ name: z.string().trim().min(1).max(80), email, password });
export const SignInInput = z.object({ email, password: z.string().min(1) });
export const VerifyEmailInput = z.object({ email, otp: z.string().regex(/^\d{6}$/) });
export const EmailInput = z.object({ email });                       // resend-verification, forgot-password
export const ResetPasswordInput = z.object({ token: z.string().min(1), newPassword: password });
export const RefreshInput = z.object({ refreshToken: z.string().min(1) });  // também sign-out

export const AccessTokenDto = z.object({ accessToken: z.string(), accessTokenExpiresAt: z.string() }); // ISO
export const MeDto = z.object({ id: z.string().uuid(), email: z.string(), displayName: z.string() });
export const AuthSessionDto = AccessTokenDto.extend({ refreshToken: z.string(), user: MeDto });
```

(+ `export type X = z.infer<typeof X>` para cada um, no padrão do arquivo.) O tamanho do código (6 dígitos) é confirmado no spike. Se o Neon usar outro tamanho, ajuste só o regex.

`apps/android/.../data/api/Dto.kt` espelha todos os itens com `@Serializable`.

### Rotas da API

Todas as rotas `/auth/*` são públicas (fora do hook de auth). Os erros seguem `{ error: string }`.

| Rota | Corpo | Sucesso | Erros |
|---|---|---|---|
| `POST /auth/sign-up` | `SignUpInput` | 201 `{ status: "verification_required" }` | 403 `not allowed`; 409 `email already registered`; 400 validação |
| `POST /auth/verify-email` | `VerifyEmailInput` | 204 | 400 `invalid code` |
| `POST /auth/resend-verification` | `EmailInput` | 204 (sempre) | — |
| `POST /auth/sign-in` | `SignInInput` | 200 `AuthSessionDto` | 401 `invalid credentials`; 403 `email not verified`; 403 `not allowed` |
| `POST /auth/refresh` | `RefreshInput` | 200 `AccessTokenDto` | 401 `invalid session` |
| `POST /auth/sign-out` | `RefreshInput` | 204 (idempotente) | — |
| `POST /auth/forgot-password` | `EmailInput` | 204 (sempre) | — |
| `POST /auth/reset-password` | `ResetPasswordInput` | 204 | 400 `invalid token` |
| `GET /me` | — (autenticada, JWT ou ApiKey) | 200 `MeDto` | 401/403 |

O `sign-in` resolve ou liga o `User` (mesma função do hook) antes de responder, então `user.id` já é o id do Índice. Qualquer falha do Neon Auth (5xx ou timeout de 10 s) vira 502 `{ error: "auth unavailable" }`.

### Regras puras (`apps/api/src/modules/auth/`, com vitest ao lado)

- `allowlist.ts`: `parseAllowlist(raw)` e `isAllowed(list, email)`.
- `credential.ts`: `classifyCredential(headers)` → `{ kind: "jwt" | "apiKey", value } | null`.
- `identity.ts`: `decideIdentity({ byAuthId, byEmail, claims, allowed })` → `use(id)` | `link(id)` | `create` | `deny("not allowed" | "email not verified")`. Sem Prisma: quem chama faz as consultas.

### Web

- Páginas novas, todas Server Components com formulário + Server Action e sem JS de cliente obrigatório: `app/entrar`, `app/criar-conta`, `app/verificar-email` (recebe `?email=`), `app/esqueci-senha`, `app/redefinir-senha` (recebe `?token=` do link do Neon; o nome exato do parâmetro vem do spike).
- `lib/session.ts`: lê e grava os cookies e chama `/auth/*`, o único lugar que conhece `indice_rt`/`indice_at`.
- O Nav ganha "Sair" (Server Action `signOut`: `POST /auth/sign-out`, apaga os cookies e redireciona).
- As mensagens de erro em PT: "e-mail ou senha incorretos", "e-mail não autorizado", "código inválido", "serviço de login indisponível, tente de novo".

### Android

- `data/auth/SessionStore.kt`, `data/auth/AuthAuthenticator.kt`, `ui/auth/` (`AuthViewModel` + telas Entrar, Criar conta, Código, Esqueci a senha).
- `IndiceApi` ganha as rotas `/auth/*` e `/me`. Login e logout passam pelo `IndiceRepository`.
- A navegação em `ui/IndiceApp.kt` decide entre fluxo de auth e abas a partir do estado da `SessionStore`.
- `HabitWidget`: sem sessão, mostra "Entre no app" e abre a `MainActivity`.
- Sign-in com 403 `email not verified`: o cliente chama `POST /auth/resend-verification` sozinho e abre a tela Código com o e-mail preenchido. Vale para o Android e para a web (página `/verificar-email`).
- O botão "Sair" fica só na aba Hoje. A tela "acesso removido" (403 `not allowed`) também tem o seu "Sair", porque nela as abas não carregam.
- `build.gradle.kts`: sai `API_KEY` do `BuildConfig` e o requisito de `-Pindice.apiKey`. O release exige só `-Pindice.apiBaseUrl`.

## Banco de dados (delta)

```prisma
model User {
  // ...campos atuais
  authUserId String? @unique   // neon_auth.user.id (claim `sub`); nulo até o primeiro login
}
```

- Migração `<timestamp>_user_auth_user_id`: aditiva (coluna nullable + índice único). É expand-only, então a revisão antiga convive.
- Sem FK para `neon_auth.user`: o schema é do Neon e não entra no Prisma.
- Nenhum dado é migrado por SQL: a ligação do usuário atual acontece no primeiro login (regra de identidade). Seed e rekey não mudam.
- `schema.md`: no mesmo commit da migração, acrescentar `USER.authUserId` (texto, único, nulo até o primeiro login), a regra "um `User` liga a no máximo uma conta do Neon Auth; ligação por e-mail verificado só quando `authUserId` é nulo" e a linha no histórico de migrações. O `schema.md` é da Leia: o Luke escolhe se a Leia edita junto com o commit do Rex ou se o Rex aplica o texto acima.

## Ambientes e infra (para o Obi)

| | Produção | QA |
|---|---|---|
| Neon Auth | habilitado na branch principal | herdado pelo `qa-reset.sh` (endpoint da branch `qa`) |
| `NEON_AUTH_BASE_URL` (env da API, não é segredo) | Auth URL da principal | Auth URL da `qa` |
| `AUTH_WEB_ORIGIN` (env da API) | URL de `indice-web` | `http://127.0.0.1:3100` |
| `INDICE_ALLOWED_EMAILS` (secret) | `indice-allowed-emails` | `indice-qa-allowed-emails` |
| Domínio confiável no Neon Auth | URL de `indice-web` | `http://127.0.0.1:3100` (Allow Localhost ligado só em QA) |
| Config do Neon Auth | Sign-up com e-mail, verificação no cadastro por código, nome "Índice", Allow Localhost **desligado** | igual, com Allow Localhost ligado |
| Web | perde `INDICE_API_KEY_WEB` | perde `INDICE_API_KEY_WEB` |

- O `cloudbuild.yaml` ganha substituições `_AUTH_BASE_URL`, `_AUTH_WEB_ORIGIN` e `_ALLOWED_EMAILS_SECRET` (com padrões de Produção) e passa `NEON_AUTH_BASE_URL`, `AUTH_WEB_ORIGIN` e o secret para a API. O `deploy.yml` passa os valores de QA. `_API_KEY_SECRET` deixa de ir para a web.
- `bootstrap.sh` cria os secrets da allowlist (valor lido do terminal sem eco, como os outros) e dá acesso à SA de runtime.
- `qa-reset.sh`: depois do reset, reaplica a config de QA do Neon Auth pela API do Neon e confere que a Auth URL de QA é a mesma do env de `indice-api-qa`. Se divergir, imprime `falhou` e não segue.
- Dev local: uma branch Neon `dev` (filha da `qa`) com Auth habilitado e Allow Localhost. O `NEON_AUTH_BASE_URL` dela vai no `.env` da raiz (não é segredo, mas fica fora do repo). Sem ela, a web local só funciona pela `dev-local-key`, que é o comportamento de hoje.
- README: login, allowlist (como adicionar ou remover uma pessoa), APK sem chave, e o passo de rotação da `indice-api-key` de Produção depois que o APK novo estiver instalado (o APK antigo leva a chave embutida).

## Pacotes de trabalho e fronteiras de arquivo sugeridas

| WP | Dono sugerido | Arquivos | Depende de |
|---|---|---|---|
| WP01 Spike + provisionamento Neon Auth | Obi | Console/API Neon (sem código no repo); `.claude/specs/current/003-login-multiusuario/spike-neon-auth.md` (novo, do Obi) | autorização do usuário para habilitar Auth na branch principal (escrita na Produção) |
| WP02 Contratos + migração | Rex | `packages/shared/src/index.ts`, `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/<ts>_user_auth_user_id/`, `.claude/specs/schema.md` (ver nota acima) | — |
| WP03 API | Rex | `apps/api/package.json` (`jose`), `apps/api/src/config.ts`, `apps/api/src/plugins/auth.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/auth.ts` (novo), `apps/api/src/modules/auth/**` (novo), `apps/api/src/lib/neon-auth-client.ts` (novo) | WP01, WP02 |
| WP04 Web | Rex | `apps/web/middleware.ts` (novo), `apps/web/lib/session.ts` (novo), `apps/web/lib/api.ts`, `apps/web/lib/actions.ts`, `apps/web/app/{entrar,criar-conta,verificar-email,esqueci-senha,redefinir-senha}/**` (novos), componente do Nav (onde estiver hoje) | WP03 (contrato fixo desde a WP02: pode começar em paralelo contra a API local) |
| WP05 Android | Engineer Android (a recrutar) | `apps/android/**` (inclui `Dto.kt`, `AndroidManifest.xml`, `build.gradle.kts`) | WP02 (contrato); prova final depende da WP03 |
| WP06 Infra | Obi | `infra/cloudrun/{cloudbuild.yaml,bootstrap.sh,qa-reset.sh,README.md}`, `.github/workflows/deploy.yml` | WP01 |
| WP07 Aceite QA + promoção | Ahsoka (validação), Obi (passos de Produção) | nenhum arquivo de código | WP03–WP06 mergeadas em `development` |

**Gate da WP01:** o spike precisa provar por curl, contra a branch `dev`, com um e-mail de teste permitido: cadastro, verificação por código, login com `Origin`, obtenção do token de sessão, `/token` com o cookie, JWT validado pelo JWKS com `iss`/`aud`, `sign-out` revogando o token de sessão, pedido de reset com `redirectTo` e o formato do link, reset, e se o `reset --parent` preserva a Auth URL da `qa`. O registro (sem token nem senha) vai no `spike-neon-auth.md`. Se o login servidor a servidor ou o `/token` com cookie falhar, é bloqueio para a Leia: a alternativa (Better Auth autogerenciado no Fastify) volta ao usuário.

## Fluxo principal: primeiro login do Andre na Produção

1. A web recebe `/` sem `indice_rt`, e o middleware redireciona para `/entrar`.
2. A Server Action chama `POST /auth/sign-in`. A API manda `sign-in` para o Neon Auth (com `Origin`), recebe o token de sessão e pede `/token` para obter o JWT.
3. A API verifica o JWT: `sub` desconhecido, `emailVerified` verdadeiro, e-mail na allowlist. Encontra o `User` pelo e-mail com `authUserId` nulo e grava `authUserId = sub`.
4. Responde `AuthSessionDto`. A web grava `indice_rt` e `indice_at` e redireciona para `/`.
5. A página chama a API com Bearer. O hook resolve `req.userId` = o mesmo id de antes, e os dados aparecem.

## Estados

- Neon Auth fora do ar: login e refresh respondem 502 e a tela mostra "serviço de login indisponível". Um JWT ainda válido continua funcionando até o `exp`, porque o JWKS fica em cache no `jose`.
- Sessão revogada ou vencida: refresh com 401, cookies apagados ou `SessionStore` limpa, tela de entrada.
- Tirado da allowlist: 403 em toda rota. A web mostra "acesso removido" com botão Sair, e o Android faz o mesmo.

## Riscos

| Risco | Mitigação |
|---|---|
| Protocolo do Neon Auth servidor a servidor não documentado (Origin, cookie, `/token`) | Gate do spike na WP01, antes de qualquer código. Plano B registrado. |
| Cadastro aberto no endpoint do Neon | A autorização fica na API, em toda requisição. Critério com conta criada por fora. |
| Chaves JWKS iguais em QA e Produção depois do reset | `issuer`/`audience` obrigatórios. Critério cruzado QA ↔ Produção. |
| SMTP compartilhado com limite e entrega incerta | Poucos usuários. "Reenviar código". SMTP próprio no INBOX se incomodar. |
| `User.email` da Produção diferente do e-mail real de login | O bootstrap da 002 já conferiu o seed contra o e-mail do usuário. O Obi confere por leitura (sem imprimir o e-mail) antes da promoção. Se divergir, corrige por SQL antes do primeiro login. |
| APK antigo com chave embutida continua abrindo a API | Rotação de `indice-api-key` na Produção depois do APK novo (passo do usuário, no README). |
| Dev local depende de branch Neon | Branch `dev` com Allow Localhost. `dev-local-key` segue para testes e curl. |

## Testes

- vitest: `allowlist`, `credential`, `identity` (todas as saídas), e verificação de JWT com chave Ed25519 gerada no teste e JWKS local (assinatura errada, vencido, emissor errado, sem `email`).
- Rotas `/auth/*`: com `app.inject` e o `neon-auth-client` substituído por um fake no teste. Cobre os códigos da tabela e o 403 do sign-up antes de chamar o fake.
- Android: `assembleDebug`. Fluxo manual no Pixel 10 pela Ahsoka.

## Fora de escopo técnico

Next 16, `@neondatabase/auth`, Data API/RLS, assinatura própria de cookie, refresh token rotativo próprio, administração de usuários, exclusão de conta.
