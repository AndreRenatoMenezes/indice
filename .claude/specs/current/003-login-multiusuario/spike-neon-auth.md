---
feature: 003-login-multiusuario
wp: WP01
autor: Obi
data: 2026-10-23
---

# Spike do Neon Auth (WP01)

Prova do protocolo servidor a servidor contra a branch `dev`, com um e-mail de teste (`<email-de-teste>`) que o usuário controla. Nenhum token, senha, código ou link completo foi gravado aqui. `BASE` = Auth URL da branch (`https://<endpoint>.neonauth.sa-east-1.aws.neon.tech/neondb/auth`). Todas as chamadas levam `Origin: http://localhost:3000` (domínio permitido pelo Allow Localhost da `dev`).

**Veredito do Gate: passou inteiro.** Login servidor a servidor e `/token` com o cookie funcionam. Não há bloqueio para a Leia.

## Os 4 pontos da Ahsoka

### 1. Nomes dos endpoints (todos sobre `BASE`)

| Ação | Chamada | Corpo | Resposta |
|---|---|---|---|
| Cadastro | `POST /sign-up/email` | `{name, email, password}` | 200 `{token: null, user{id, emailVerified:false, ...}}`; envia o OTP |
| Reenviar código | `POST /email-otp/send-verification-otp` | `{email, type:"email-verification"}` | 200 `{success:true}` |
| Verificar | `POST /email-otp/verify-email` | `{email, otp}` | 200 `{status:true, token:null, user}`; 400 `OTP_EXPIRED` se vencido |
| Login | `POST /sign-in/email` | `{email, password}` | 200 `{redirect:false, token, user}` + `Set-Cookie` |
| JWT | `GET /token` | cookie de sessão | 200 `{token: <jwt>}` |
| Sessão | `GET /get-session` | cookie de sessão | 200; JWT também no header `set-auth-jwt` |
| Sair | `POST /sign-out` | `{}` + cookie | 200 `{success:true}` |
| Pedir reset | `POST /request-password-reset` | `{email, redirectTo}` | 200 `{status:true, message}` |
| Link do e-mail | `GET /reset-password/<token>?callbackURL=<redirectTo>` | — | 302 para `<redirectTo>?token=<token>` |
| Trocar senha | `POST /reset-password` | `{token, newPassword}` | 200 `{status:true}` |
| Chaves | `GET /.well-known/jwks.json` | — | 200 `{keys:[{alg:"EdDSA", crv:"Ed25519", kty:"OKP", kid, x}]}` |

Outros achados:
- `Origin` é obrigatório na prática para o `redirectTo` (validado contra os domínios confiáveis). O `/token` respondeu 200 também sem `Origin`; a API manda sempre `Origin: AUTH_WEB_ORIGIN`.
- `redirectTo` fora dos domínios confiáveis: 403 `{code:"INVALID_REDIRECT_URL"}`. Em Produção, `redirectTo` e o domínio confiável são a URL de `indice-web`.
- `request-password-reset` responde igual (200, mesma mensagem) para e-mail existente e inexistente.
- `sign-out` repetido com a mesma sessão também responde 200 (idempotente).
- Login com senha errada: 401 `{code:"INVALID_EMAIL_OR_PASSWORD"}`.
- O OpenAPI público da branch (`GET /open-api/generate-schema`) lista os endpoints acima.

### 2. Token de sessão e JWT (`/token`)

- Cookie de sessão: **`__Secure-neon-auth.session_token`** (com hífen em `neon-auth`; o plano escrevia `neonauth`, e esse nome dá 401). Atributos: `Max-Age=604800` (7 dias), `Path=/`, `HttpOnly`, `Secure`, `SameSite=None`, `Partitioned`.
- O valor do cookie tem a forma `<token>.<assinatura>`, URL-encoded (81 caracteres no teste), e o `token` do corpo do `sign-in` tem 32 caracteres e é só o prefixo. Enviar só o `token` do corpo ao `/token` dá **401**. Portanto o `refreshToken` da API é o **valor completo do cookie, como veio no `Set-Cookie`** (URL-encoded, sem decodificar), reenviado como `Cookie: __Secure-neon-auth.session_token=<valor>`.
- `GET /token` com esse cookie: 200 `{token}`, um JWT de 3 segmentos.
- JWT: cabeçalho `{alg:"EdDSA", kid}`. Validade **900 s** (`exp - iat`). Verificado com `jose` (`createRemoteJWKSet` + `jwtVerify`, `algorithms:["EdDSA"]`) contra o JWKS da mesma branch: **OK** com `issuer` e `audience` iguais à **origem** da Auth URL (`https://<endpoint>.neonauth.sa-east-1.aws.neon.tech`, sem `/neondb/auth`). Com `issuer`/`audience` iguais à URL base completa, falha com `ERR_JWT_CLAIM_VALIDATION_FAILED`.
- `sign-out` revoga a sessão: `/token` com o mesmo cookie passa a dar **401**. Um JWT já emitido segue válido até o `exp` (não há revogação do JWT).

### 3. OTP e e-mail não verificado

- O OTP tem **6 dígitos** (confirma o regex `^\d{6}$` do `plan.md`).
- O primeiro código **expirou** antes de ser usado: `verify-email` deu 400 `{code:"OTP_EXPIRED"}` (tempo exato não medido; passou de alguns minutos). Pedir outro por `send-verification-otp` resolve; é o "reenviar código" do plano. O OTP novo verificou com 200.
- `sign-in` de e-mail **não verificado**: **403** `{message:"Email not verified", code:"EMAIL_NOT_VERIFIED"}` (não cria sessão). Depois da verificação, `sign-up` com `Auto Sign In After Verify: false` não devolve token: o login é um passo separado.

### 4. Link de reset, `redirectTo` e claims

- O e-mail traz o link `BASE/reset-password/<token>?callbackURL=<redirectTo codificado>`. O token tem 24 caracteres.
- Abrir o link responde **302** com `Location: <redirectTo>?token=<token>`. O parâmetro é **`token`** (como o `plan.md` presumia) e o token do redirect é o mesmo do link.
- `POST /reset-password {token, newPassword}`: 200 `{status:true}`. Reuso do mesmo token: 400 `{code:"INVALID_TOKEN"}`. Depois: senha antiga 401, senha nova 200.
- O `redirectTo` que a API manda deve ser `${AUTH_WEB_ORIGIN}/redefinir-senha`, e `AUTH_WEB_ORIGIN` tem de ser domínio confiável do Neon Auth do ambiente.
- Claims reais do JWT: `sub` (igual a `id`), `id`, `email`, `emailVerified` (**booleano real**), `name`, `role` (`"authenticated"`), `banned`, `banReason`, `banExpires`, `createdAt`, `updatedAt`, `iat`, `exp`, `iss`, `aud`. `iss` = `aud` = origem da Auth URL da branch. Sem claims customizadas.

## Gate do plan.md, item a item

| Item | Resultado |
|---|---|
| Cadastro | ok (200, `emailVerified:false`) |
| Verificação por código | ok (6 dígitos; código vencido dá 400; reenvio funciona) |
| Login com `Origin` | ok; antes da verificação 403 `EMAIL_NOT_VERIFIED` |
| Token de sessão | ok: valor completo do cookie `__Secure-neon-auth.session_token` |
| `/token` com o cookie | ok, 200, JWT EdDSA de 900 s |
| JWT pelo JWKS com `iss`/`aud` | ok com a origem; falha com a URL base completa |
| `sign-out` revoga | ok (`/token` depois: 401) |
| Reset com `redirectTo` e formato do link | ok (`?token=`; `redirectTo` validado contra domínios confiáveis) |
| Reset | ok (token de uso único) |
| `reset --parent` preserva a Auth URL da `qa` | ok, ver abaixo |

## Branches e `reset --parent`

- Estado final de config (lido por `neonctl neon-auth config email-password get`): `production`, `qa` e `dev` com e-mail+senha, verificação `otp`, `Require Verification: true`, `Send Email On Sign Up: true`, `Auto Sign In After Verify: false`.
- `dev` (recriada em 2026-10-23, emenda do plano): a primeira `dev` (filha da `qa`, onde o spike rodou) e a branch `qa-pre-reset-20261023` foram apagadas e a `dev` voltou com `neonctl branches create --name dev --parent production --no-secrets`. O Auth já veio habilitado, com a config da principal (otp, verificação exigida), Allow Localhost `true` e **Auth URL própria nova** (`ep-dawn-hall-...`). Não precisou de `neonctl neon-auth enable`. A senha do `neondb_owner` da `dev` foi trocada por `reset_password` (valor descartado, nada gravado), porque a filha herda a da Produção. A conta de teste do spike morreu com a primeira `dev` e o spike não foi refeito: a prova vale para a branch antiga, e o protocolo é o mesmo da `dev` nova (mesmo Better Auth gerenciado).
- Allow Localhost em `production` estava `true` (herdado); o plano pede `false`. Fica para o usuário rodar `neonctl neon-auth domain allow-localhost disable --project-id <id> --branch production`.
- **`neonctl branches reset qa --parent` falha enquanto a `qa` tem filha**: `ERROR: Branch has children, preserve_under_name is required`. Decisão (emenda do plano): a `dev` fica filha da principal, a `qa` não tem filha e o `qa-reset.sh` aborta com `falhou: qa tem filha <nome>` se houver, sem usar `--preserve-under-name` (que deixaria uma branch a mais por reset na cota do plano Free). O reset com `--preserve-under-name` foi o que o spike exercitou; o reset simples, sem filha, ainda não foi executado.
- Depois do reset com `--preserve-under-name`:
  - **Auth URL da `qa` preservada** (`BASE` idêntico ao anterior).
  - Config preservada: e-mail+senha, `otp`, verificação exigida, Allow Localhost `true`, remetente "Neon Auth". Domínios confiáveis: não havia nenhum antes, e não há depois (não dá para dizer se o reset os apagaria; o `qa-reset.sh` reaplica de qualquer forma).
  - **Chave JWKS da `qa` mudou** (outro `kid`), e as chaves de `qa` e de `production` já eram diferentes antes do reset. A premissa do plano ("as chaves JWKS são copiadas no reset") não se confirmou; o `issuer`/`audience` obrigatório continua sendo a separação principal, e agora há também chaves distintas. JWT de QA emitido antes do reset deixa de verificar.
  - Efeito colateral conhecido: o reset devolve à `qa` as senhas de banco da principal. O `qa-db-password.sh` rodou depois (2026-10-23): `qa-db-password: ok` (QA aceita a credencial nova, Produção a recusa, versões antigas destruídas, revisão nova de `indice-api-qa`).

## Flags finais de `neonctl` para o `qa-reset.sh`

Confirmados nesta sessão (`--project-id <id> --branch qa`):

```
neonctl neon-auth config email-password update --enabled true --email-verification-method otp \
  --require-email-verification true --send-verification-email-on-sign-up true \
  --auto-sign-in-after-verification false --disable-sign-up false
neonctl neon-auth domain list
neonctl neon-auth domain add <origem>
neonctl neon-auth domain allow-localhost get | enable | disable
neonctl neon-auth status          # linha "  Base URL:       <url>"
neonctl branches reset qa --parent --project-id <id>     # a qa sem filha; com filha o Neon recusa
```

Não foi exercitado nesta sessão: `domain add` e `domain list` com domínios (a `qa` não tinha nenhum), e `email-provider update` (o usuário roda). O `qa-reset.sh` usa a pré-condição de a `qa` não ter filha e reaplica a config na ordem do plano (ver `plan.md`).

## Comandos usados (sem segredo)

`curl` contra `BASE` com os endpoints da tabela; `jose` (`jwtVerify`) para o JWT; `neonctl branches list|get|create|reset`; `neonctl neon-auth status|domain list|domain allow-localhost get|config email-password get|update|config email-provider get`. A senha de teste foi gerada aleatória, ficou fora do repositório e foi apagada no fim; o usuário digitou o OTP e colou o link de reset no terminal.

## Riscos e pendências para a WP03/WP06

- O nome do cookie e a forma `<token>.<assinatura>` mudam o `neon-auth-client.ts` do Rex (`NEON_AUTH_PROTOCOL_CONFIRMED` pode virar `true`). O Rex não deve decodificar nem reconstruir o valor.
- Allow Localhost de `production` ainda `true`.
- A `dev` ocupa a cota do plano Free; a branch preservada foi apagada.
- **O nome "Índice" do remetente não é aplicável no SMTP compartilhado**: `email-provider update --type shared --sender-name "Índice"` roda, mas imprime `--sender-email and --sender-name are ignored for the shared email provider` e o nome segue "Neon Auth" (`auth@mail.myneon.app`) em `production`, `qa` e `dev`. Só `--type standard` (SMTP próprio, fora de escopo) aceita nome. Os e-mails de OTP e reset chegam como "Neon Auth".
