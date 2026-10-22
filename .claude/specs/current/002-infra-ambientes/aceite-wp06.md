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
| 9 | Web QA anônima responde 403 e proxy carrega a página | pendente-do-usuário | `13-chaves.txt`, `14-iam-web-qa.txt` e `16-pos-pr8-iam.txt` provam 403 anônimo. Falta o usuário confirmar a página pelo proxy `127.0.0.1:3100`. |
| 10 | Reset QA recopia dados, reaplica migrações, mantém só a chave QA e devolve dados | aprovado | `18-roteiro-qa-reset.md`; PASSO5 confirmou ledger, `ApiKey=1`, `User=1`, `Habit=4`, `/habits/today` 200 e comprimento igual ao da Produção. |
| 11 | Senha dos secrets QA diferente da Produção, host Prod recusa e versões antigas não permanecem | aprovado | `18-roteiro-qa-reset.md`; PASSO5 confirmou senha distinta, recusa por autenticação e uma versão não destruída por secret. |
| 12 | Repositórios separados, limpeza efetiva de 10 versões e nenhuma imagem QA em `indice` | aprovado | `09-prova-a.txt`, `09e-bootstrap-3.txt`, `09e-bootstrap-4.txt`, `16-pos-pr8-imagens.txt` e PASSO5 (`repo_indice_sem_qa=sim`). |
| 13 | Build sem `_TAG` falha antes de publicar imagem | aprovado | `12-prova-b.txt`, `12-sem-tag-submit.log` e `12-tag-vazia-submit.log`. |
| 14 | Repositório sem connection string, chave de API ou JSON de conta de serviço | aprovado-condicionado | A credencial publicada em `docs/deploy-manual.md` foi rotacionada e é inválida: `21-rotacao-gates-antes.txt`, `21-rotacao-execucao.txt`, `21-rotacao-gates-depois.txt`, `21-rotacao-depois-obi.txt` e a verificação independente registram P1000, nova credencial funcional, QA isolada, chaves, ledger e revisão. O valor antigo continua no histórico público no commit `0a41786`; o HEAD de `development` ainda contém as duas linhas conhecidas até o merge da correção de `docs/deploy-manual.md`. Condição: merge desse ajuste antes de fechar o critério. |
| 15 | WIF recusa outro repositório e Environment `production` aceita somente `main` | aprovado | `19-github-protecao.txt` e `21-rotacao-github-depois.txt` provam proteções, branches permitidas e Environment `production`. Leitura read-only do provider: issuer `https://token.actions.githubusercontent.com`; mapping exato de `google.subject`, `attribute.repository`, `attribute.ref` e `attribute.environment`; condição `assertion.repository == 'AndreRenatoMenezes/indice'`. |
| 16 | README cobre preparação, branches, rollback e APK QA | aprovado | `infra/cloudrun/README.md`, seções de preparação, fluxo, `update-traffic`, proxy/reset e APK QA. |
| 17 | Senha de QA diferente da de Produção após `qa-db-password` | aprovado | `18-roteiro-qa-reset.md` e PASSO5: senha distinta nos dois secrets, QA aceita a própria credencial e Produção recusa a credencial de QA; versões antigas destruídas. |
| 18 | Rotação da senha de Produção após o incidente | aprovado-condicionado | `21-rotacao-gates-antes.txt`, `21-rotacao-execucao.txt`, `21-rotacao-gates-depois.txt`, `21-rotacao-depois-obi.txt`, `21-rotacao-github-depois.txt` e verificação independente: versões antigas destruídas, revisão nova saudável, senha vazada recusada, QA preservada, chaves e dados íntegros, e nenhum segredo no GitHub. Condição: merge da correção de `docs/deploy-manual.md`; o histórico público permanece, mas o valor está invalidado. |

## Resumo

- Aprovados: 14
- Aprovados condicionados: 2
- Reprovados: 0
- Pendentes do usuário: 1
- Adiados para WP07: 1

Pendência final do usuário: confirmar a página da web QA pelo proxy local
`127.0.0.1:3100` e fazer o merge da correção de `docs/deploy-manual.md` para
retirar do HEAD as duas linhas históricas conhecidas. A promoção para Produção
continua fora da WP06 e deve ser tratada na WP07.
