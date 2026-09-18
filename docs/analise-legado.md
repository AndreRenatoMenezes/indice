# Análise do legado → Índice

Data: 2026-09-18. Fontes: `app-financeiro` (React + Supabase, 32 features) e
`weektodo-journal` (fork Vue 3 do WeekToDo, offline-first).

## 1. Lógica reaproveitável (portar como módulos puros na API)

| Origem (app-financeiro `src/lib/`) | Regra | Destino na API |
|---|---|---|
| `calculations/balance.js` | Saldo = Entradas − Saídas − Investimentos − contas abertas; orçamento diário = saldo / dias restantes | `finance/balance.ts` |
| `accounts.js` | Saldo por conta: `openingBalance + Σ mov. na janela [openingDate, D]`; compra em fatura não movimenta conta; heurística de saque | `finance/account-balance.ts` |
| `invoiceCycle.js` | Ciclo de fatura (5 regras): fechamento F / vencimento V, clamp de dia, ref = mês do vencimento; status efetivo (`Aberta`/`Fechada` derivado, `Paga` só explícito) | `finance/invoice-cycle.ts` |
| `installments.js` | Identidade de parcela `parc:<fnv1a(card|desc|total|valor)>:<n>`; projeção das parcelas futuras | `finance/installments.ts` |
| `subscriptions.js` | Próxima renovação (mensal/anual com clamp); valor mensalizado | `finance/subscriptions.ts` |
| `importId.js` | `normalizeDescription`, FNV-1a, `ofx:`/`gen:`/`agg:` | `finance/import-id.ts` |
| `dedup.js`, `reconcileHints.js`, `invoiceReconcile.js` | Graus de duplicata (exact/divergent), sugestão de pagamento de fatura e estorno | `finance/reconcile.ts` (fase 2) |
| `calculations/trafficLight.js` | Semáforo "posso gastar hoje?": razão sugerido/média (≥1.2 verde, ≥0.9 amarelo) | `daily-summary` |
| `calculations/projections.js` | Dias até o próximo salário | `daily-summary` |
| `insights/rules.js` | Regras de alerta (contas vencidas, saldo negativo, categoria estourou) | `finance/insights.ts` (fase 2) |
| `learnedRules.js` | Regra aprendida por descrição normalizada + tipo, precede keyword e IA | `finance/categorization.ts` |
| `statementParsers.js`, `invoiceParsers.js` | Parsers OFX/CSV | `finance/parsers/` (fase 2) |
| `supabase/functions/_shared/ai/*` | `runChain`: retry, backoff, degradação entre modelos, circuit breaker | `lib/ai-chain.ts` (fase 2, para import por IA) |

| Origem (weektodo-journal) | Regra | Destino |
|---|---|---|
| `helpers/repeatingEvents.js` + `repeating_events_by_date` | Materialização de RRULE uma única vez por data | `journal/recurrence.ts` + tabela `RecurrenceInstance` |
| `helpers/tasksHelper.js` | Ordenação: pendentes antes de concluídas, depois por hora | `journal/ordering.ts` |
| `helpers/syncMerge.js` | Merge de 3 vias (base/local/remoto) com desempate determinístico | Base do sync offline do Android (fase 2) |
| `config.moveOldTasks` | Tarefas não feitas de dias passados migram para hoje | `Entry.status = MIGRATED` + `migratedFromId` (o "•→>" do Bullet Journal) |

## 2. Mapeamento de entidades

### Financeiro
| Legado (Supabase) | Índice (Prisma) | Observações |
|---|---|---|
| `expenses`, `income`, `investments`, `transfers` | `Transaction` (`type`) | Tabela unificada. `month 0..11` → `date` (derivado). `operation` → `paymentMethod`. `origin`/`invest_type` → `Category(kind)`. |
| `banks` | `Institution` | Ciclo de fatura continua por instituição (feature 020). |
| `accounts` | `Account` | Idêntico; `kind` vira enum. |
| `credit_cards` | `CreditCard` | Ganha `institutionId` obrigatório. |
| `card_invoices` | `CardInvoice` | `ref_month 0..11` → `refMonth 1..12`. |
| `bills` + `bill_months` | `Bill` + `BillOccurrence` | `applicable_months` reindexado para 1..12. |
| `subscriptions` | `Subscription` | `active` → `cancelledAt`. |
| `budgets` (`month_ref 'YYYY-MM'`) | `Budget(year, month)` | |
| `goals` (meta de poupança mensal) | `MonthlyTarget` | Renomeada; `Goal` passa a ser meta de longo prazo. |
| `investment_plans` | `InvestmentPlan` | |
| `categorization_rules` | `CategorizationRule` | `category` texto → `categoryId`. |
| `user_options` (arrays), `salary_config` | `Category` + `UserSettings` | |
| `profiles` | `User` | |
| `telegram_*` | — | Fora do escopo inicial. Entrada rápida será via widget Android + `ApiKey`. Reavaliar depois. |
| `import_id` solto | `ImportBatch` + `Transaction.importId` | Auditoria por arquivo. |

### Journal / tarefas
| Legado (IndexedDB) | Índice | Observações |
|---|---|---|
| `todo_lists["YYYYMMDD"]` | `Collection(kind=DAILY, date)` | |
| `todo_lists["Nome da lista"]` | `Collection(kind=CUSTOM)` | Id deixa de ser o nome. |
| tarefa `{text, checked, desc, subTaskList, color, priority, tags, time, alarm, repeatingEvent}` | `Entry` | `subTaskList` → `Entry.parentId`; `checked` → `status`; `repeatingEvent` → `recurrenceRuleId`. `priority` e `tags` existiam sem UI; aqui ganham uso. |
| `repeating_events` | `RecurrenceRule` | |
| `repeating_events_by_date` | `RecurrenceInstance` | PK `(ruleId, date)`. |
| roadmap "entrada de diário por dia" | `DailyLog` | Humor, energia, hora que acordou, reflexão. |

### Novos módulos (sem legado)
- **Hábitos:** `Habit` (BOOLEAN/COUNTER/DURATION/TIME, dias da semana) + `HabitLog` (1 por dia, `done` pré-resolvido para o widget).
- **Metas:** `Goal` + `GoalMilestone` + `GoalContribution` (série temporal) + `GoalSnapshot` (progresso, ritmo, data projetada — dataset para o Colab).
- **Mídia:** `MediaItem` + `MediaNote` (resenha/aprendizado/citação) + `MediaSession` (sessão de leitura/jogo).

## 3. Decisões de modelagem
1. **UUID gerado no cliente** — Android/widget gravam offline e sincronizam depois sem renumeração.
2. **`updatedAt` + `deletedAt` em tudo** — pull incremental por `updatedAt > since`; nenhuma tabela de lápides separada.
3. **Meses 1..12** — o legado usava 0..11 (herança do JS); a migração soma 1.
4. **Polimorfismo por discriminador**, não por tabela por tipo: `Entry.kind`, `Transaction.type`, `Category.kind`, `Habit.kind`, `Goal.kind`. Uma tabela por família, colunas opcionais validadas na API.
5. **Saldos nunca gravados** — sempre derivados de `Transaction` (regra já validada no legado com 638 testes).
6. **`Source` em registros rápidos** — permite medir quanto da rotina entra pelo widget.

## 4. Endpoint `/daily-summary` (contrato inicial)
```
GET /daily-summary?date=2026-09-18
{
  date, dayOfWeek,
  journal:  { entries: Entry[] (DAILY do dia + MIGRATED pendentes), log: DailyLog | null },
  habits:   [{ habit, log, done, streak }],
  finance:  { balanceToday, monthBalance, dailyBudget, trafficLight, billsDueSoon[], invoicesDueSoon[], daysToSalary },
  goals:    [{ id, title, progressPct, projectedDate, requiredMonthly }],   // só ACTIVE, top 3 por prioridade
  media:    [{ id, title, kind, progress }]                                  // só IN_PROGRESS
}
```
