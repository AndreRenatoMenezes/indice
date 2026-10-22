# Aceite WP06 — 002-infra-ambientes

Relatório independente baseado em `spec.md`, no Plano de aceite de `plan.md` e
nas provas existentes. Nenhum segredo, connection string, chave, e-mail ou
identificador do Neon é reproduzido aqui.

| # | Critério de `spec.md` | Veredito | Evidência |
|---:|---|---|---|
| 1 | `prev` mergeada em `development` antes do primeiro PR da feature; nenhuma branch apagada sem autorização | aprovado | `git log --all --merges --oneline --grep='prev'` mostra o PR #6; plano de aceite, item (a), registra WP00. |
| 2 | PR para `development` com CI vermelho bloqueado por proteção e checks `node` + `android` | aprovado | `~/indice-wp04-provas/19-github-protecao.txt`: proteção lida de volta, checks `node`/`android`, modo estrito, admins sem bypass e push direto recusado no espelho. |
| 3 | PR para `main` com CI vermelho bloqueado e push direto recusado, sem bypass | aprovado | `~/indice-wp04-provas/19-github-protecao.txt`: `main` protegida, admins sem bypass, force-push/deleção bloqueados e mensagem GH006 no teste do espelho. |
| 4 | Merge em `development` publica revisões QA com a imagem do commit mergeado | aprovado | PASSO3; deploy do PR #9 concluído, revisões QA novas com a tag do merge e `/health=200`. |
| 5 | Merge em `main` publica Produção somente após aprovação no Environment `production` | adiado-para-WP07 | A promoção `development` → `main` e o deploy de Produção pertencem à WP07. |
| 6 | Migração mergeada em `development` aplicada em QA e ausente na Produção | aprovado | PASSO3; ledger QA contém `aceite_002_noop` finalizada e o ledger da Produção contém apenas `init`. |
| 7 | Migração com erro falha antes de `gcloud run deploy`, mantendo a revisão anterior | aprovado | `17-build-passos.txt`, `17-build.log`, `17-qa-antes.txt`, `17-qa-depois.txt` e `17-limpeza.txt`: migrate falhou, deploys ficaram `QUEUED`, QA permaneceu saudável e a limpeza terminou `ok`. |
| 8 | Health QA e chaves cruzadas 200/401, inclusive após reset | aprovado | `13-chaves.txt`, `13-gate.txt`, `16-pos-pr8-health.txt`; PASSO5 confirmou novamente `200/401/200/401` e `/health=200`. |
| 9 | Web QA anônima responde 403 e proxy carrega a página | aprovado | `13-chaves.txt`, `14-iam-web-qa.txt` e `16-pos-pr8-iam.txt` provam 403 anônimo. Verificação independente via proxy local `127.0.0.1:3100` (`gcloud run services proxy indice-web-qa`): curl HTTP 200; portal 'Portal' carregou a home (Hoje) e a página da semana (`/semana`) com navegação, 7 colunas de dias e seção de listas. Screenshot registrado em `~/indice-wp04-provas/23-proxy-semana.png`; proxy encerrado e porta 3100 confirmada livre. |
| 10 | Reset QA recopia dados, reaplica migrações, mantém só a chave QA e devolve dados | aprovado | `18-roteiro-qa-reset.md`; PASSO5 confirmou ledger, `ApiKey=1`, `User=1`, `Habit=4`, `/habits/today` 200 e comprimento igual ao da Produção. |
| 11 | Senha dos secrets QA diferente da Produção, host Prod recusa e versões antigas não permanecem | aprovado | `18-roteiro-qa-reset.md`; PASSO5 confirmou senha distinta, recusa por autenticação e uma versão não destruída por secret. |
| 12 | Repositórios separados, limpeza efetiva de 10 versões e nenhuma imagem QA em `indice` | aprovado | `09-prova-a.txt`, `09e-bootstrap-3.txt`, `09e-bootstrap-4.txt`, `16-pos-pr8-imagens.txt` e PASSO5 (`repo_indice_sem_qa=sim`). |
| 13 | Build sem `_TAG` falha antes de publicar imagem | aprovado | `12-prova-b.txt`, `12-sem-tag-submit.log` e `12-tag-vazia-submit.log`. |
| 14 | Repositório sem connection string, chave de API ou JSON de conta de serviço | aprovado | PR #10 (`chore/002-fechamento`) mergeado em `development` em 2026-10-22T12:56:23Z (commit `f269ca4`). `git grep 'postgresql://'` em `origin/development` retorna apenas placeholders locais (`.env.example`, `ci.yml`, `docker-compose.yml`) e comentários com `USUARIO:SENHA@HOST` em `docs/deploy-manual.md:157-158`. `git grep 'private_key\|BEGIN PRIVATE KEY'` retorna zero fora de texto do plano. `git grep` de padrões de senha Neon retorna zero. Diff `0a41786..origin/development` confirma remoção das linhas com credencial real e adição de aviso de segurança. Histórico público retém o valor no commit `0a41786`, mas a credencial foi rotacionada (ROTACAO=ok). |
| 15 | WIF recusa outro repositório e Environment `production` aceita somente `main` | aprovado | `19-github-protecao.txt` e `21-rotacao-github-depois.txt` provam proteções, branches permitidas e Environment `production`. Leitura read-only do provider: issuer `https://token.actions.githubusercontent.com`; mapping exato de `google.subject`, `attribute.repository`, `attribute.ref` e `attribute.environment`; condição `assertion.repository == 'AndreRenatoMenezes/indice'`. |
| 16 | README cobre preparação, branches, rollback e APK QA | aprovado | `infra/cloudrun/README.md`, seções de preparação, fluxo, `update-traffic`, proxy/reset e APK QA. |
| 17 | Senha de QA diferente da de Produção após `qa-db-password` | aprovado | `18-roteiro-qa-reset.md` e PASSO5: senha distinta nos dois secrets, QA aceita a própria credencial e Produção recusa a credencial de QA; versões antigas destruídas. |
| 18 | Rotação da senha de Produção após o incidente | aprovado | Rotação executada pelo usuário e verificada (ROTACAO=ok). PR #10 mergeado em `development` em 2026-10-22T12:56:23Z (commit `f269ca4`): `docs/deploy-manual.md` contém apenas placeholders (`USUARIO:SENHA@HOST`) e aviso de segurança no HEAD. Diff `0a41786..origin/development` confirma remoção das credenciais. Provas: `21-rotacao-gates-antes.txt`, `21-rotacao-execucao.txt`, `21-rotacao-gates-depois.txt`, `21-rotacao-depois-obi.txt`, `21-rotacao-github-depois.txt`. Versões antigas dos secrets destruídas, revisão `indice-api-00004-54v` saudável com a nova credencial, senha vazada recusada. Histórico público retém o valor no commit `0a41786`, invalidado pela rotação. |

## Resumo

- Aprovados: 17
- Aprovados condicionados: 0
- Reprovados: 0
- Pendentes do usuário: 0
- Adiados para WP07: 1

O critério 9 foi validado de forma independente pela Reviewer via proxy local
`127.0.0.1:3100` e portal 'Portal', sem pendências restantes para o usuário na
WP06. A promoção para Produção pertence à WP07 (já executada e aprovada).

**Nota sobre o deploy do PR #10:** o deploy automático de QA disparado pelo
merge do PR #10 (commit `f269ca4`) **falhou no CI** — job `node` / step
`npm run build` abortou por erro de `next/font` em `apps/web/app/layout.tsx`
(run 39782519937, conclusion=failure). O job `deploy` foi corretamente pulado
pelo CI vermelho. QA continua servindo a revisão do PR #9 (deploy SUCCESS,
run 39684663918). Produção intacta: `indice-api-00004-54v` e
`indice-web-00003-c65`, health 200. O erro de build é preexistente e não
relacionado às mudanças do PR #10 (docs/specs/scripts). O build quebrado em
`development` deve ser corrigido antes da WP07.
