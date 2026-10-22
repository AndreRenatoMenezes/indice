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

### WP03 — API
- Lane: revisão
- Dono: Rex
- Possui: `apps/api/package.json`, `apps/api/src/config.ts`, `apps/api/src/plugins/auth.ts`, `apps/api/src/app.ts`, `apps/api/src/routes/auth.ts`, `apps/api/src/modules/auth/**`, `apps/api/src/lib/neon-auth-client.ts`
- Fora de escopo: `apps/web/**`, `apps/android/**`, `infra/**`
- Objetivo: fachada `/auth/*`, `/me`, verificação de JWT, allowlist e identidade conforme o plano.
- Aceite: critérios de "Dados e acesso" da spec cobertos por vitest; `npm run typecheck|test|build` passam.
- Evidência: saída dos comandos; testes listados por critério.
- Depende de: WP01, WP02
- Log:
  - 2026-10-22 · Rex · implementado: `jose` em `apps/api/package.json`; `config.ts` (env obrigatórias em produção, allowlist, timeout 10 s, limite 10/min); `modules/auth/{allowlist,credential,identity,jwt,resolve-user,user-store,context}.ts` com vitest ao lado; `lib/neon-auth-client.ts` (interface + HTTP); `plugins/auth.ts` (ApiKey ou JWT, allowlist e vínculo em toda requisição); `routes/auth.ts` (`/auth/*` e `GET /me`); `app.ts` (contexto injetável, checagem de produção, limite por rota).
  - 2026-10-22 · Rex · pendência do protocolo isolada em `lib/neon-auth-client.ts`: `[plano]` cookie `__Secure-neonauth.session_token`, `GET /token` e JWKS; nomes dos demais endpoints, corpo do `/token`, tamanho do OTP (6 em `packages/shared`) e parâmetro do link de reset (`token`) seguem `[provisório]` do Better Auth 1.7.6 até o `spike-neon-auth.md` da WP01. `NEON_AUTH_PROTOCOL_CONFIRMED=false` mantém aviso no log ao subir com auth; troca em um lugar só.
  - 2026-10-22 · Rex · vitest: 146 testes em 17 arquivos (novos: `config` 5, `allowlist` 6, `credential` 6, `identity` 5, `resolve-user` 10, `jwt` 10, `neon-auth-client` 13, `routes/auth` 30). Cobrem: ligação por e-mail sem diferenciar caixa e `User.id` preservado; criação de Índice vazio; e-mail fora da lista com 403 e sem `User`; JWT inválido/vencido/outro emissor/outra audiência → 401; retirada da lista → 403; `email not verified` → 403; normalize expirado → 401; 502 do provedor; 400/409/503; 10/min por IP (11ª = 429); `NODE_ENV=production` sem env não sobe e nomeia o que falta.
  - 2026-10-22 · Rex · gates: `npm run typecheck` (7/7), `npm run test` (146/146) e `npm run build` (5/5) com código 0. `apps/web/**`, `apps/android/**` e `infra/**` intocados. Sem stage/commit (Chewie).
  - 2026-10-22 · Rex · ressalva da Ahsoka: `trustProxy: true` virou 1 salto confiável (`hop < 1`, equivalente a `trust: 1` do proxy-addr). A API é exposta direto em `*.run.app` (`cloudbuild.yaml` sem balanceador), então o Cloud Run é o único proxy e o `req.ip` passa a ser a última entrada do `X-Forwarded-For`, não a forjada à esquerda. Teste novo em `routes/auth.test.ts` ("X-Forwarded-For forjado não burla o limite por IP"): 11 requisições com IP real fixo à direita → 429 na 11ª; com `trustProxy: true` o mesmo teste falha (conferido antes do ajuste). Gates re-rodados: typecheck 7/7, test 147/147, build 5/5. Se um balanceador externo entrar na frente, revisar o número de saltos.

### WP06 — Infra
- Lane: revisão
- Dono: Obi
- Possui: `infra/cloudrun/{cloudbuild.yaml,bootstrap.sh,qa-reset.sh,README.md}`, `.github/workflows/deploy.yml`
- Fora de escopo: `apps/**`, `packages/**`
- Objetivo: env/secrets de auth, qa-reset reaplicando a config de QA, README de allowlist e rotação.
- Aceite: critérios "Ambientes" da spec; scripts idempotentes; nenhum e-mail ou segredo no repositório.
- Evidência: diff e prova do `qa-reset` quando autorizado.
- Depende de: WP01
- Log:
  - 2026-10-22 · Obi · parte de arquivos pronta, só edição local (nenhum `gcloud`/`neonctl` de escrita, nenhum deploy): `cloudbuild.yaml` (`_AUTH_BASE_URL`, `_AUTH_WEB_ORIGIN` vazia = URL da web, `_ALLOWED_EMAILS_SECRET`; API recebe `NEON_AUTH_BASE_URL`, `AUTH_WEB_ORIGIN` e o secret `INDICE_ALLOWED_EMAILS`; web sem `INDICE_API_KEY_WEB`, com `--remove-secrets`; `_API_KEY_SECRET` removida); `deploy.yml` (valores de QA, origem `http://127.0.0.1:3100`); `bootstrap.sh` (secrets `indice-allowed-emails` e `indice-qa-allowed-emails` por stdin sem eco, acesso à SA de runtime, idempotente); `qa-reset.sh` (reaplica config de QA, domínio e Allow Localhost, confere Auth URL e sai com `falhou` se divergir); `README.md` (login, allowlist, APK sem chave, rotação da `indice-api-key`).
  - Validação: `bash -n` nos scripts e YAML válido (ruby). `shellcheck` e `actionlint` não instalados. Nenhum e-mail ou segredo nos arquivos.
  - **Pendente, depende da WP01 e de autorização do usuário:** bloco do `qa-reset.sh` marcado `TODO(spike-neon-auth.md)` (flags de `neonctl neon-auth` e se o reset muda a Auth URL ou apaga domínios); Auth URL de QA no `deploy.yml` lida do estado atual (confirmar no spike); `--remove-secrets` de secret ausente no primeiro deploy; job `indice-rekey` de Produção (README); prova real do `qa-reset`, do `bootstrap.sh` e do deploy.

### WP07 — Aceite em QA e promoção
- Lane: planejado
- Dono: Ahsoka (validação), Obi (passos de Produção)
- Possui: nenhum arquivo de código
- Fora de escopo: tudo que for código
- Objetivo: validar todos os critérios da spec em QA e, com autorização do usuário, promover.
- Aceite: todos os critérios da spec com evidência independente.
- Evidência: relatório da Ahsoka.
- Depende de: WP03–WP06 mergeadas em `development`
