---
feature: 003-login-multiusuario
dominio: auth
tags: [login, multiusuario, neon-auth, better-auth, jwt, android, web]
status: pronto   # esclarecendo | pronto
criada_em: 2026-10-22
---

# Login e múltiplos usuários

## Em uma frase

Web e Android passam a exigir login com e-mail e senha (Neon Auth). Cada pessoa autorizada tem o próprio Índice, e eu continuo vendo os meus dados de hoje.

## O que muda na prática

- **Hoje:** não há login. A web de Produção é pública, e a chave fica no servidor, então qualquer pessoa com a URL vê e altera tudo (bug no INBOX). O APK leva a chave embutida. Existe um só usuário.
- **Depois:** web e Android abrem numa tela de entrada. Só entra quem tem conta verificada **e** cujo e-mail está na lista de permitidos do ambiente. Cada usuário vê apenas os próprios dados.
- **Meus dados continuam meus:** no primeiro login com o meu e-mail, a conta nova se liga ao usuário que já existe. Nada é copiado nem recriado.
- **Quem não está na lista não entra:** o cadastro recusa o e-mail. Uma conta criada por fora, direto no serviço de auth, também não recebe nada da API.
- **A chave de API vira coisa de máquina:** continua valendo para automações (agendamento dos snapshots de metas, scripts). A web e o APK deixam de usá-la.

## Decisões do usuário (2026-10-22)

1. **Provedor:** Neon Auth (Managed Better Auth), no mesmo projeto Neon dos dois ambientes. Antes de escolher, o usuário viu os contras: SDK em beta que exige Next 16, dev e CI dependentes de uma branch Neon, QA herdando os usuários da Produção a cada reset, e Android sem plugin `bearer`.
2. **Acesso:** lista de e-mails permitidos por ambiente, exigindo e-mail verificado.
3. **Método:** e-mail e senha, com verificação por código no cadastro e redefinição de senha por e-mail. Sem Google, sem OTP como forma de login.
4. **X-Api-Key:** fica só para automações, sempre ligada a um usuário dono. Web e Android passam a usar só o login.

## O que o sistema precisa lembrar

- O vínculo entre a conta de login e o usuário do Índice é permanente: um usuário do Índice tem no máximo uma conta de login, e cada conta de login aponta para no máximo um usuário.
- No primeiro login, a ligação usa o e-mail (sem diferenciar maiúsculas) e só acontece com o e-mail verificado. Se não houver usuário com aquele e-mail, nasce um Índice vazio.
- A lista de permitidos é conferida em toda requisição. Tirar um e-mail da lista corta o acesso na revisão seguinte da API, sem apagar nenhum dado.
- Os e-mails da lista são dado pessoal e não entram no repositório.
- A sessão de QA não abre a Produção, e a de Produção não abre QA.

## Está pronto quando

Web:
- [ ] Sem sessão, qualquer página da web redireciona para `/entrar`, e nenhuma Server Action devolve ou altera dado.
- [ ] Cadastro com e-mail permitido: chega um código por e-mail, informo o código, entro e vejo o Índice.
- [ ] Cadastro com e-mail fora da lista: a tela mostra "e-mail não autorizado" e nenhuma conta é criada no Neon Auth.
- [ ] Senha errada mostra "e-mail ou senha incorretos". Conta não verificada leva à tela do código.
- [ ] Fico mais de 15 minutos parado e navego de novo: tudo funciona sem novo login (renovação transparente).
- [ ] "Sair" encerra a sessão: a página volta para `/entrar`, e o token de renovação antigo responde 401 na API.
- [ ] "Esqueci a senha": chega um link, defino a senha nova em `/redefinir-senha`, a nova funciona e a antiga falha.

Dados e acesso:
- [ ] No meu primeiro login na Produção vejo os dados de antes: mesmo `User.id`, `authUserId` preenchido e a contagem de `User` inalterada.
- [ ] Um segundo usuário permitido entra num Índice vazio. Com o token dele, um recurso meu de cada módulo (bullet, lançamento, meta, hábito, mídia) responde 404 ou não aparece na lista.
- [ ] Conta criada direto no endpoint do Neon Auth com e-mail fora da lista: o JWT dela recebe 403 em toda rota, e nenhuma linha nasce em `User`.
- [ ] JWT com assinatura inválida, vencido ou de outro emissor (token de QA na Produção e o contrário) recebe 401.
- [ ] Tirar meu segundo usuário da lista (versão nova do secret e revisão nova da API) faz a próxima requisição dele receber 403. Os dados dele continuam no banco.
- [ ] `X-Api-Key` válida continua respondendo 200, como no agendamento de snapshots. O serviço `indice-web` não tem mais `INDICE_API_KEY_WEB`, e o APK de release é gerado sem `-Pindice.apiKey`.
- [ ] Em `NODE_ENV=production`, a API não sobe sem `NEON_AUTH_BASE_URL`, `AUTH_WEB_ORIGIN` ou `INDICE_ALLOWED_EMAILS`, e diz qual falta.

Android:
- [ ] O app abre na tela de entrada. Com login feito, as abas e o widget de hábitos carregam.
- [ ] Fecho o app e abro de novo: continuo logado. Depois de mais de 15 minutos, as requisições seguem funcionando sem novo login.
- [ ] Cadastro com código funciona no app. "Esqueci a senha" dispara o e-mail, que leva à página da web.
- [ ] "Sair" volta para a tela de entrada, e o widget passa a mostrar "Entre no app".
- [ ] O token de sessão não entra no backup do Android.

Ambientes:
- [ ] Depois do `qa-reset.sh`, o login de QA funciona no endpoint de auth de QA, com o domínio confiável de QA restaurado.
- [ ] Nenhum e-mail da lista nem segredo de auth entra no repositório (grep no diff da feature).

Definição de Pronto:
- [ ] `npm run typecheck`, `npm run test` e `npm run build` passam. `./gradlew :app:assembleDebug` passa.
- [ ] Migração versionada e `schema.md` no mesmo commit. `Dto.kt` espelha os contratos novos.

## Não entra agora

- Login com Google ou outro OAuth, MFA, passkey, login por código sem senha.
- Compartilhar dados entre usuários (família, organizações).
- Tela para administrar a lista de permitidos: ela muda por secret.
- Trocar e-mail, excluir a própria conta pelo app (fica no INBOX), SMTP próprio (fica o compartilhado do Neon).
- Atualizar para o Next 16 ou usar o SDK `@neondatabase/auth`.
- Abrir a web de QA ao público: continua fechada por IAM.
- Categorias, hábitos ou metas iniciais para usuário novo.
