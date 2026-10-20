# Equipe

Fonte da verdade da partitura. Nomes exatos como aparecem em `maestri list`.

| Codinome | Papel | Paths que possui | Portais |
|---|---|---|---|
| Luke | Maestro (orquestra; não implementa) | `.claude/specs/{tasks,tasks-done,equipe,bloqueios,decisoes}.md` | — |
| Leia | Arquiteto | `.claude/specs/**/{spec,plan}.md`, `schema.md`, `INBOX.md`, `ROADMAP.md` | — |
| Chewie | Git Master (único com git/GitHub) | git, branches, PRs | — |
| Rex | Engineer web/API | `apps/web/**`, `apps/api/**`, `packages/**` (quando houver WP) | Portal (web, Cloud Run) |
| Ahsoka | Reviewer (valida por diff e evidência; sem código) | nenhum | Portal (web, Cloud Run), Pixel 10 |

## Vagas previstas (ainda não recrutadas)

- Engineer Android: `apps/android/**`. Recrutar quando houver spec Android.
- Engineer DevOps (role `Engineer-DevOps` criado): `.github/workflows/**`, `infra/cloudrun/**`. Spec 002 pronta; falta recrutar (aguarda escolha de preset).

## Regras fixas

- Um dono por path. Dois executores ativos nunca editam o mesmo arquivo.
- Git e GitHub só pelo Chewie.
- Nada destrutivo ou externo (merge, deploy, release, proteção de branch) sem autorização explícita do usuário.
- Quem produz não aprova: Ahsoka valida, não Rex.
