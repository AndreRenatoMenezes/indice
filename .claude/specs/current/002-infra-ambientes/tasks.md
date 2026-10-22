# Tasks — 002-infra-ambientes

Lanes: planejado → fazendo → revisão → pronto. Contrato em `spec.md` e `plan.md` (Leia). Ordem: WP00 → (WP01 ∥ WP02) → WP03 → WP04 → WP05 → WP06.

### WP07 — Primeira promoção `development` → `main`
- Lane: fazendo (autorizada pelo usuário em 2026-10-22; deploy de Produção só com a aprovação do usuário no Environment `production`)
- Dono: Chewie (PRs) · Obi (branch Neon de segurança) · Ahsoka (verificação)
- Possui: nenhum arquivo
- Objetivo: publicar a 001 e a 002 em Produção pelo `deploy.yml` de `main`, com migração expand-only (`aceite_002_noop`), branch Neon `pre-promocao-<data>` como segurança e verificação independente depois do deploy.
- Aceite: critério 5 da `spec.md` (merge em `main` publica Produção somente após aprovação) com revisão nova da API e da web, tag igual ao SHA, `aceite_002_noop` no ledger de Produção, chaves cruzadas 200/401 e `/health` 200.
- Evidência: run do `deploy.yml`, ledger, revisões e health, sem segredos.
- Depende de: WP06 aprovada; CI de `development` verde.
