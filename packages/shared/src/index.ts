// Contratos compartilhados entre API, Web e (como referência) Android.
// Tudo que sai da API passa por estes schemas; o Android espelha os DTOs em
// apps/android/.../data/api/Dto.kt.
import { z } from "zod";

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:mm");
export const money = z.number().finite();

// ── Journal ────────────────────────────────────────────────────────────────
export const EntryKind = z.enum(["TASK", "EVENT", "NOTE"]);
export const EntryStatus = z.enum(["OPEN", "DONE", "MIGRATED", "SCHEDULED", "CANCELLED"]);

const EntryBase = z.object({
  id: z.string(),
  collectionId: z.string(),
  parentId: z.string().nullable(),
  kind: EntryKind,
  status: EntryStatus,
  text: z.string(),
  description: z.string().nullable(),
  date: isoDate.nullable(),
  time: hhmm.nullable(),
  alarm: z.boolean(),
  priority: z.number().int(),
  color: z.string().nullable(),
  tags: z.array(z.string()),
  position: z.number().int(),
  goalId: z.string().nullable(),
  mediaItemId: z.string().nullable(),
  recurrenceRuleId: z.string().nullable(),
});
export type EntryDto = z.infer<typeof EntryBase> & { children?: EntryDto[] };
export const EntryDto: z.ZodType<EntryDto> = EntryBase.extend({
  children: z.array(z.lazy(() => EntryDto)).optional(),
});

export const CreateEntryInput = z.object({
  id: z.string().uuid().optional(),
  date: isoDate.optional(),
  collectionId: z.string().optional(),
  parentId: z.string().optional(),
  kind: EntryKind.default("TASK"),
  text: z.string().min(1),
  description: z.string().optional(),
  time: hhmm.optional(),
  alarm: z.boolean().optional(),
  priority: z.number().int().min(0).max(3).optional(),
  color: z.string().optional(),
  tags: z.array(z.string()).optional(),
  goalId: z.string().optional(),
  mediaItemId: z.string().optional(),
  source: z.enum(["WEB", "ANDROID", "WIDGET", "API"]).optional(),
});
export type CreateEntryInput = z.infer<typeof CreateEntryInput>;

// Onde a entrada mora (data, lista, pai) só muda por `/move`; a ordem também.
// `kind` é redeclarado sem default: no zod 4, `.partial()` mantém o
// `.default("TASK")` e todo PATCH gravaria `kind: TASK`. `null` limpa os
// campos opcionais (tirar a hora, a cor, as notas, a meta).
export const UpdateEntryInput = CreateEntryInput
  .omit({ id: true, date: true, collectionId: true, parentId: true, source: true })
  .partial()
  .extend({
    kind: EntryKind.optional(),
    status: EntryStatus.optional(),
    description: z.string().nullable().optional(),
    time: hhmm.nullable().optional(),
    color: z.string().nullable().optional(),
    goalId: z.string().nullable().optional(),
    mediaItemId: z.string().nullable().optional(),
  });
export type UpdateEntryInput = z.infer<typeof UpdateEntryInput>;

// Soltar numa data (dia) ou numa lista; sem nenhum dos dois, só reordena.
// `beforeId` ausente ou null = fim das manuais (sem hora e abertas).
export const MoveEntryInput = z.object({
  date: isoDate.optional(),
  collectionId: z.string().optional(),
  beforeId: z.string().nullable().optional(),
}).refine((v) => !(v.date && v.collectionId), { message: "date ou collectionId, não os dois" });
export type MoveEntryInput = z.infer<typeof MoveEntryInput>;

const Ids = z.array(z.string()).min(1).max(200);
export const EntryBatchInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("complete"), ids: Ids }),
  z.object({ action: z.literal("migrate"), ids: Ids, date: isoDate }),
  z.object({ action: z.literal("delete"), ids: Ids }),
  z.object({ action: z.literal("restore"), ids: Ids }),
]);
export type EntryBatchInput = z.infer<typeof EntryBatchInput>;

// Opções de repetição no formato do WeekToDo; a RRULE é derivada delas.
export const RecurrenceInput = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "WEEKDAYS", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).max(99).default(1),
  weekdays: z.array(z.number().int().min(1).max(7)).optional(), // WEEKLY; vazio = dia da tarefa (1 = seg)
  monthDays: z.array(z.number().int().min(1).max(31)).optional(), // MONTHLY; vazio = dia da tarefa
  end: z.discriminatedUnion("type", [
    z.object({ type: z.literal("never") }),
    z.object({ type: z.literal("count"), count: z.number().int().min(1).max(999) }),
    z.object({ type: z.literal("until"), date: isoDate }),
  ]).default({ type: "never" }),
});
export type RecurrenceInput = z.infer<typeof RecurrenceInput>;

export const RecurrenceRuleDto = z.object({
  id: z.string(),
  text: z.string(),
  summary: z.string(), // "toda segunda · até 31/12/2026"
  startDate: isoDate,
  endDate: isoDate.nullable(),
  options: RecurrenceInput,
});
export type RecurrenceRuleDto = z.infer<typeof RecurrenceRuleDto>;

export const CustomListDto = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  sortOrder: z.number().int(),
  entries: z.array(EntryDto),
});
export type CustomListDto = z.infer<typeof CustomListDto>;

export const CreateListInput = z.object({ name: z.string().trim().min(1).max(60), color: z.string().optional() });
export type CreateListInput = z.infer<typeof CreateListInput>;
export const UpdateListInput = CreateListInput.partial();
export type UpdateListInput = z.infer<typeof UpdateListInput>;
export const ReorderListsInput = z.object({ ids: z.array(z.string()).min(1) });
export type ReorderListsInput = z.infer<typeof ReorderListsInput>;

// ── Hábitos ────────────────────────────────────────────────────────────────
export const HabitKind = z.enum(["BOOLEAN", "COUNTER", "DURATION", "TIME"]);

export const HabitDto = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  kind: HabitKind,
  unit: z.string().nullable(),
  targetValue: money.nullable(),
  targetTime: hhmm.nullable(),
  weekdays: z.array(z.number().int()),
  sortOrder: z.number().int(),
});
export type HabitDto = z.infer<typeof HabitDto>;

export const HabitLogDto = z.object({
  habitId: z.string(),
  date: isoDate,
  value: money,
  done: z.boolean(),
  note: z.string().nullable(),
});
export type HabitLogDto = z.infer<typeof HabitLogDto>;

export const LogHabitInput = z.object({
  date: isoDate.optional(),
  value: money.optional(), // BOOLEAN: omitido = 1; TIME: minutos desde 00:00 ou use `time`
  time: hhmm.optional(),
  note: z.string().optional(),
  source: z.enum(["WEB", "ANDROID", "WIDGET", "API"]).optional(),
});
export type LogHabitInput = z.infer<typeof LogHabitInput>;

// Estado de um dia na régua semanal: feito, perdido, hoje (pendente), fora da
// escala do hábito ou ainda por vir.
export const HabitDayStatus = z.enum(["done", "miss", "today", "off", "future"]);
export const HabitDayDto = z.object({ date: isoDate, status: HabitDayStatus });
export type HabitDayDto = z.infer<typeof HabitDayDto>;

export const HabitTodayDto = z.object({
  habit: HabitDto,
  log: HabitLogDto.nullable(),
  done: z.boolean(),
  streak: z.number().int(),
  scheduledToday: z.boolean(),
  week: z.array(HabitDayDto), // 7 dias, segunda a domingo da semana da data
  consistency30: z.number(), // % dos dias escalados nos últimos 30 com `done`
});
export type HabitTodayDto = z.infer<typeof HabitTodayDto>;

export const CreateHabitInput = z.object({
  name: z.string().min(1),
  kind: HabitKind.default("BOOLEAN"),
  icon: z.string().optional(),
  color: z.string().optional(),
  unit: z.string().optional(),
  targetValue: z.number().positive().optional(),
  targetTime: hhmm.optional(),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).optional(),
  reminderAt: hhmm.optional(),
  startDate: isoDate.optional(),
});
export type CreateHabitInput = z.infer<typeof CreateHabitInput>;

// ── Financeiro ─────────────────────────────────────────────────────────────
export const TransactionType = z.enum(["EXPENSE", "INCOME", "INVESTMENT", "TRANSFER"]);
export const PaymentMethod = z.enum(["DEBIT", "PIX", "CREDIT", "CASH", "BOLETO", "OTHER"]);

export const TransactionDto = z.object({
  id: z.string(),
  type: TransactionType,
  date: isoDate,
  amount: money,
  description: z.string(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable().optional(),
  paymentMethod: PaymentMethod.nullable(),
  accountId: z.string().nullable(),
  toAccountId: z.string().nullable(),
  creditCardId: z.string().nullable(),
  invoiceId: z.string().nullable(),
  installmentNo: z.number().int().nullable(),
  installmentTotal: z.number().int().nullable(),
  // Rótulos para a linha secundária ("pix · Conta corrente", "crédito · Roxinho ····1234 · fatura 11/26").
  accountName: z.string().nullable().optional(),
  toAccountName: z.string().nullable().optional(),
  creditCardLabel: z.string().nullable().optional(),
  invoiceRef: z.string().nullable().optional(), // "MM/YYYY"
});
export type TransactionDto = z.infer<typeof TransactionDto>;

export const AccountKind = z.enum(["CHECKING", "SAVINGS", "PAYMENT", "CASH", "INVESTMENT"]);
export const AccountDto = z.object({
  id: z.string(),
  name: z.string(),
  kind: AccountKind,
  institution: z.string().nullable(),
  color: z.string().nullable(),
  isDefault: z.boolean(),
  balance: money,
});
export type AccountDto = z.infer<typeof AccountDto>;

export const CategoryKind = z.enum(["EXPENSE", "INCOME", "INVESTMENT"]);
export const CategoryDto = z.object({
  id: z.string(),
  kind: CategoryKind,
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  system: z.boolean(),
});
export type CategoryDto = z.infer<typeof CategoryDto>;

export const CreditCardDto = z.object({ id: z.string(), nickname: z.string(), brand: z.string(), last4: z.string() });
export const InstitutionDto = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  color: z.string().nullable(),
  closingDay: z.number().int().nullable(),
  dueDay: z.number().int().nullable(),
  cards: z.array(CreditCardDto),
});
export type InstitutionDto = z.infer<typeof InstitutionDto>;

export const InvoiceDto = z.object({
  id: z.string(),
  institution: z.string(),
  refYear: z.number().int(),
  refMonth: z.number().int(),
  closingDate: isoDate.nullable(),
  dueDate: isoDate.nullable(),
  total: money,
  declaredTotal: money.nullable(),
  purchases: z.number().int(),
  status: z.string(),
});
export type InvoiceDto = z.infer<typeof InvoiceDto>;

export const CreateTransactionInput = z.object({
  id: z.string().uuid().optional(),
  type: TransactionType,
  date: isoDate,
  amount: z.number().positive(),
  description: z.string().default(""),
  categoryId: z.string().optional(),
  paymentMethod: PaymentMethod.optional(),
  accountId: z.string().optional(),
  toAccountId: z.string().optional(),
  creditCardId: z.string().optional(),
  notes: z.string().optional(),
  source: z.enum(["WEB", "ANDROID", "WIDGET", "API"]).optional(),
});
export type CreateTransactionInput = z.infer<typeof CreateTransactionInput>;

export const TrafficLightStatus = z.enum(["green", "yellow", "red"]);
export const TrafficLightDto = z.object({
  status: TrafficLightStatus,
  label: z.string(),
  message: z.string(),
});

export const FinanceSummaryDto = z.object({
  month: z.object({ year: z.number().int(), month: z.number().int() }),
  totalIncome: money,
  totalExpense: money,
  totalInvestment: money,
  openBills: money,
  balance: money,
  dailyBudget: money,
  daysRemaining: z.number().int(),
  spentToday: money,
  trafficLight: TrafficLightDto,
  daysToSalary: z.number().int().nullable(),
  billsDueSoon: z.array(z.object({ id: z.string(), name: z.string(), amount: money, dueDay: z.number().int().nullable() })),
  invoicesDueSoon: z.array(z.object({ id: z.string(), institution: z.string(), total: money, dueDate: isoDate, status: z.string() })),
});
export type FinanceSummaryDto = z.infer<typeof FinanceSummaryDto>;

// ── Metas ──────────────────────────────────────────────────────────────────
export const GoalKind = z.enum(["FINANCIAL", "NUMERIC", "HABIT", "MILESTONE"]);
export const GoalStatus = z.enum(["ACTIVE", "PAUSED", "ACHIEVED", "ABANDONED"]);

export const GoalProgressDto = z.object({
  id: z.string(),
  title: z.string(),
  kind: GoalKind,
  status: GoalStatus,
  targetValue: money,
  currentValue: money,
  progressPct: z.number(),
  startDate: isoDate,
  targetDate: isoDate.nullable(),
  daysRemaining: z.number().int().nullable(),
  paceMonthly: money.nullable(),
  requiredMonthly: money.nullable(),
  projectedDate: isoDate.nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
});
export type GoalProgressDto = z.infer<typeof GoalProgressDto>;

export const CreateGoalInput = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  kind: GoalKind.default("FINANCIAL"),
  targetValue: z.number().nonnegative(),
  unit: z.string().optional(),
  startDate: isoDate.optional(),
  targetDate: isoDate.optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  priority: z.number().int().optional(),
  linkedAccountId: z.string().optional(),
  linkedCategoryId: z.string().optional(),
  linkedHabitId: z.string().optional(),
});
export type CreateGoalInput = z.infer<typeof CreateGoalInput>;

export const UpdateGoalInput = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: GoalStatus.optional(),
  targetValue: z.number().nonnegative().optional(),
  targetDate: isoDate.nullable().optional(),
  priority: z.number().int().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});
export type UpdateGoalInput = z.infer<typeof UpdateGoalInput>;

export const GoalMilestoneDto = z.object({
  id: z.string(),
  title: z.string(),
  targetValue: money.nullable(),
  targetDate: isoDate.nullable(),
  achievedAt: z.string().nullable(),
});
export const GoalContributionDto = z.object({
  id: z.string(),
  date: isoDate,
  amount: money,
  note: z.string().nullable(),
  transactionId: z.string().nullable(),
});
export const GoalDetailDto = GoalProgressDto.extend({
  description: z.string().nullable(),
  unit: z.string().nullable(),
  milestones: z.array(GoalMilestoneDto),
  contributions: z.array(GoalContributionDto),
});
export type GoalDetailDto = z.infer<typeof GoalDetailDto>;

export const ContributeGoalInput = z.object({
  date: isoDate.optional(),
  amount: z.number(),
  note: z.string().optional(),
  transactionId: z.string().optional(),
});

// ── Mídia ──────────────────────────────────────────────────────────────────
export const MediaKind = z.enum(["BOOK", "GAME", "MOVIE", "SERIES", "COURSE", "ARTICLE", "PODCAST"]);
export const MediaStatus = z.enum(["WISHLIST", "IN_PROGRESS", "PAUSED", "DONE", "DROPPED"]);

export const MediaItemDto = z.object({
  id: z.string(),
  kind: MediaKind,
  title: z.string(),
  creator: z.string().nullable(),
  year: z.number().int().nullable(),
  platform: z.string().nullable(),
  status: MediaStatus,
  rating: z.number().int().nullable(),
  progress: money.nullable(),
  progressTotal: money.nullable(),
  progressUnit: z.string().nullable(),
  tags: z.array(z.string()),
  startedAt: isoDate.nullable(),
  finishedAt: isoDate.nullable(),
});
export type MediaItemDto = z.infer<typeof MediaItemDto>;

export const CreateMediaItemInput = z.object({
  kind: MediaKind,
  title: z.string().min(1),
  creator: z.string().optional(),
  year: z.number().int().optional(),
  platform: z.string().optional(),
  externalId: z.string().optional(),
  coverUrl: z.string().url().optional(),
  status: MediaStatus.optional(),
  progressTotal: z.number().optional(),
  progressUnit: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const UpdateMediaItemInput = z.object({
  status: MediaStatus.optional(),
  rating: z.number().int().min(1).max(10).optional(),
  progress: z.number().optional(),
  progressTotal: z.number().optional(),
  progressUnit: z.string().optional(),
  tags: z.array(z.string()).optional(),
  title: z.string().min(1).optional(),
  creator: z.string().optional(),
  platform: z.string().optional(),
});
export type UpdateMediaItemInput = z.infer<typeof UpdateMediaItemInput>;

export const CreateMediaNoteInput = z.object({
  kind: z.enum(["REVIEW", "LEARNING", "QUOTE", "NOTE"]).default("NOTE"),
  title: z.string().optional(),
  body: z.string().min(1),
  position: z.string().optional(),
});

// ── Visão diária ───────────────────────────────────────────────────────────
export const DailyLogDto = z.object({
  date: isoDate,
  wokeAt: hhmm.nullable(),
  mood: z.number().int().nullable(),
  energy: z.number().int().nullable(),
  sleepHours: money.nullable(),
  highlights: z.string().nullable(),
  reflection: z.string().nullable(),
});

export type DailyLogDto = z.infer<typeof DailyLogDto>;

export const UpsertDailyLogInput = z.object({
  wokeAt: hhmm.optional(),
  mood: z.number().int().min(1).max(5).optional(),
  energy: z.number().int().min(1).max(5).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  highlights: z.string().optional(),
  reflection: z.string().optional(),
});
export type UpsertDailyLogInput = z.infer<typeof UpsertDailyLogInput>;

export const DailySummaryDto = z.object({
  date: isoDate,
  weekday: z.number().int(), // 1 = segunda … 7 = domingo
  journal: z.object({
    collectionId: z.string().nullable(),
    entries: z.array(EntryDto),
    carriedOver: z.array(EntryDto), // OPEN de dias anteriores, candidatas a migrar
    log: DailyLogDto.nullable(),
  }),
  habits: z.array(HabitTodayDto),
  finance: FinanceSummaryDto,
  goals: z.array(GoalProgressDto),
  media: z.array(MediaItemDto),
});
export type DailySummaryDto = z.infer<typeof DailySummaryDto>;

export const ErrorDto = z.object({ error: z.string(), details: z.unknown().optional() });
