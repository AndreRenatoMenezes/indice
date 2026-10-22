# Equipe

Fonte da verdade da partitura. Nomes exatos como aparecem em `maestri list`.

| Codinome | Papel | Paths que possui | Portais |
|---|---|---|---|
| Luke | Maestro (orquestra; não implementa) | `.claude/specs/{tasks,tasks-done,equipe,bloqueios,decisoes}.md` | — |
| Leia | Arquiteto | `.claude/specs/**/{spec,plan}.md`, `schema.md`, `INBOX.md`, `ROADMAP.md` | — |
| Chewie | Git Master (único com git/GitHub) | git, branches, PRs | — |
| Rex | Engineer web/API | `apps/web/**`, `apps/api/**`, `packages/**` (quando houver WP) | Portal (web, Cloud Run) |
| Obi | Engineer DevOps | `.github/workflows/**`, `infra/cloudrun/**`, spike da 003 | — |
| Cassian | Engineer Android | `apps/android/**` | — |
| Ahsoka | Reviewer (valida por diff e evidência; sem código) | nenhum | Portal (web, Cloud Run), Pixel 10 |

## Vagas previstas (ainda não recrutadas)

- Engineer Android (Cassian, role `Engineer-Android`): `apps/android/**`. Recrutado para a WP05 da 003 (Claude Code).

## Regras fixas

- Um dono por path. Dois executores ativos nunca editam o mesmo arquivo.
- Git e GitHub só pelo Chewie.
- Nada destrutivo ou externo (merge, deploy, release, proteção de branch) sem autorização explícita do usuário.
- Quem produz não aprova: Ahsoka valida, não Rex.
