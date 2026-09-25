---
atualizado_em: 2026-09-25
---

# Banco de dados

Visão legível do banco para as specs. O schema executável é
`packages/db/prisma/schema.prisma`: toda WP que altera o banco muda os dois no
mesmo commit da migração.

O `plan.md` de cada feature mostra apenas o **delta** — nunca uma cópia deste
arquivo.

**Cobertura parcial (adoção do fluxo em 2026-09-25):** por ora só o domínio
**Journal**, que é o que a primeira feature toca. Financeiro, Hábitos, Metas e
Mídia entram aqui quando uma feature mexer neles; até lá, consulte o
`schema.prisma`.

Convenções do projeto: toda tabela de dado de usuário tem `userId` e toda
consulta filtra por ele; soft delete por `deletedAt`; datas de calendário em
`@db.Date`; saldos e contadores nunca gravados, sempre derivados.

## Diagrama — Journal

```mermaid
erDiagram
    USER ||--o{ COLLECTION : tem
    USER ||--o{ ENTRY : tem
    USER ||--o{ RECURRENCE_RULE : tem
    USER ||--o{ DAILY_LOG : tem
    COLLECTION ||--o{ ENTRY : contem
    ENTRY ||--o{ ENTRY : "subtarefas (parentId)"
    ENTRY |o--o| ENTRY : "migrada de (migratedFromId)"
    RECURRENCE_RULE ||--o{ ENTRY : gera
    RECURRENCE_RULE ||--o{ RECURRENCE_INSTANCE : materializa
    ENTRY ||--o| RECURRENCE_INSTANCE : "instancia de"
    GOAL |o--o{ ENTRY : "serve a"
    MEDIA_ITEM |o--o{ ENTRY : "serve a"

    COLLECTION {
        uuid id PK
        uuid userId FK
        enum kind "DAILY | MONTHLY | FUTURE | CUSTOM"
        text name
        date date "DAILY: o dia; MONTHLY: 1o do mês"
        text color
        int sortOrder
        bool archived
        timestamptz deletedAt
    }

    ENTRY {
        uuid id PK
        uuid userId FK
        uuid collectionId FK
        uuid parentId FK "subtarefa"
        enum kind "TASK | EVENT | NOTE"
        enum status "OPEN | DONE | MIGRATED | SCHEDULED | CANCELLED"
        text text
        text description "markdown (notas)"
        date date "denormalizada da coleção DAILY"
        text time "HH:mm"
        bool alarm
        int priority "0 nenhuma a 3 alta"
        text color
        text_array tags
        int position
        timestamptz completedAt
        uuid migratedFromId FK "UK"
        uuid recurrenceRuleId FK
        uuid goalId FK
        uuid mediaItemId FK
        enum source "WEB | ANDROID | WIDGET | API | IMPORT | SYSTEM"
        timestamptz deletedAt
    }

    RECURRENCE_RULE {
        uuid id PK
        uuid userId FK
        text rrule "RFC 5545"
        date startDate
        date endDate
        json template "molde do bullet"
        bool active
        timestamptz deletedAt
    }

    RECURRENCE_INSTANCE {
        uuid ruleId PK
        date date PK
        uuid entryId FK "UK"
    }

    DAILY_LOG {
        uuid id PK
        uuid userId FK
        date date "UK com userId"
        text wokeAt "HH:mm"
        int mood "1..5"
        int energy "1..5"
        decimal sleepHours
        text highlights
        text reflection
        timestamptz deletedAt
    }
```

## Regras de integridade — Journal

- **Uma coleção DAILY por dia** (e uma MONTHLY por mês) por usuário: é criada sob demanda quando o dia recebe o primeiro bullet.
- **Todo bullet pertence a uma coleção.** `entry.date` repete a data da coleção DAILY para consultas por intervalo; ao mover um bullet de dia, coleção e data mudam juntas.
- **Subtarefa é um bullet com `parentId`**, na mesma coleção e data do pai. Apagar o pai de verdade apaga as subtarefas (`ON DELETE CASCADE`); no uso normal o apagar é lógico (`deletedAt`).
- **Migração (• → ›)** cria um bullet novo no dia-alvo, que aponta para a origem por `migratedFromId` (único: cada origem migra uma vez); a origem fica `MIGRATED`. Se a origem sumir, o vínculo vira nulo.
- **Meta, mídia e regra de recorrência são vínculos opcionais**: apagar qualquer um deles deixa o bullet e só limpa o vínculo (`SET NULL`).
- **Uma regra de recorrência materializa no máximo um bullet por data** (`RecurrenceInstance` com chave `ruleId + date`), mesmo com dois dispositivos abrindo o mesmo dia.
- **Um registro de diário (humor, energia, reflexão) por dia** por usuário.
- **Excluir o usuário apaga tudo dele** (`ON DELETE CASCADE` a partir de `User`).

## Histórico de migrações

| Data | Feature | Mudança | Tipo |
|---|---|---|---|
| 2026-09-18 | (pré-SDD) | `20260918200928_init`: schema inicial completo | aditiva |
