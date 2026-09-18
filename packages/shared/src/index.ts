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

export const UpdateEntryInput = CreateEntryInput.partial().extend({
  status: EntryStatus.optional(),
  position: z.number().int().optional(),
});
export type UpdateEntryInput = z.infer<typeof UpdateEntryInput>;

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

export const HabitTodayDto = z.object({
  habit: HabitDto,
  log: HabitLogDto.nullable(),
  done: z.boolean(),
  streak: z.number().int(),
  scheduledToday: z.boolean(),
});
export type HabitTodayDto = z.infer<typeof HabitTodayDto>;

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
});
export type TransactionDto = z.infer<typeof TransactionDto>;

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
