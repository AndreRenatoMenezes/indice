// Cliente da API para Server Components. A chave fica no servidor (env sem
// NEXT_PUBLIC_), nunca chega ao navegador.
import type {
  AccountDto, CategoryDto, DailySummaryDto, GoalDetailDto, GoalProgressDto, HabitDto, HabitTodayDto,
  InstitutionDto, InvoiceDto, MediaItemDto, TransactionDto,
} from "@indice/shared";

const BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const KEY = process.env.INDICE_API_KEY_WEB ?? process.env.INDICE_API_KEY ?? "dev-local-key";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-api-key": KEY, ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${res.status} em ${path}: ${await res.text()}`);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const getDailySummary = (date?: string) => api<DailySummaryDto>(`/daily-summary${date ? `?date=${date}` : ""}`);
export const getTransactions = (q = "") => api<{ transactions: TransactionDto[] }>(`/transactions${q}`);
export const getAccounts = () => api<{ accounts: AccountDto[]; unassigned: number }>("/accounts");
export const getCategories = () => api<{ categories: CategoryDto[] }>("/categories");
export const getInstitutions = () => api<{ institutions: InstitutionDto[] }>("/institutions");
export const getInvoices = () => api<{ invoices: InvoiceDto[] }>("/invoices");
export const getHabits = () => api<{ habits: HabitDto[] }>("/habits");
export const getHabitsToday = (date?: string) => api<{ date: string; habits: HabitTodayDto[] }>(`/habits/today${date ? `?date=${date}` : ""}`);
export const getGoals = () => api<{ goals: GoalProgressDto[] }>("/goals");
export const getGoal = (id: string) => api<GoalDetailDto>(`/goals/${id}`);
export const getMedia = (q = "") => api<{ items: MediaItemDto[] }>(`/media${q}`);

export const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
export const dateBR = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
export const shortDate = (iso: string) => iso.slice(5).split("-").reverse().join("/"); // "18/09"

export const PAYMENT_LABEL: Record<string, string> = { DEBIT: "débito", PIX: "pix", CREDIT: "crédito", CASH: "dinheiro", BOLETO: "boleto", OTHER: "outro" };
export const TX_LABEL: Record<string, string> = { EXPENSE: "saída", INCOME: "entrada", INVESTMENT: "aporte", TRANSFER: "transferência" };
export const MEDIA_KIND_LABEL: Record<string, string> = { BOOK: "Livro", GAME: "Jogo", MOVIE: "Filme", SERIES: "Série", COURSE: "Curso", ARTICLE: "Artigo", PODCAST: "Podcast" };
export const MEDIA_STATUS_LABEL: Record<string, string> = { IN_PROGRESS: "Em andamento", WISHLIST: "Quero", PAUSED: "Pausados", DONE: "Concluídos", DROPPED: "Abandonados" };
export const GOAL_KIND_LABEL: Record<string, string> = { FINANCIAL: "financeira", NUMERIC: "numérica", HABIT: "de hábito", MILESTONE: "por marcos" };

// Linha secundária de um lançamento: "pix · Conta corrente" | "crédito · Roxinho ····1234 · fatura 11/26".
export function txSubline(t: TransactionDto): string {
  const parts: string[] = [];
  if (t.type === "INCOME") parts.push("entrada");
  else if (t.type === "INVESTMENT") parts.push("aporte");
  else if (t.paymentMethod) parts.push(PAYMENT_LABEL[t.paymentMethod] ?? t.paymentMethod.toLowerCase());
  if (t.creditCardLabel) parts.push(t.creditCardLabel);
  else if (t.accountName) parts.push(t.accountName);
  if (t.toAccountName) parts.push(`→ ${t.toAccountName}`);
  if (t.invoiceRef) parts.push(`fatura ${t.invoiceRef.replace(/\/20(\d\d)$/, "/$1")}`);
  if (t.installmentNo) parts.push(`${t.installmentNo}/${t.installmentTotal}`);
  return parts.join(" · ");
}

// Descrição da escala/meta de um hábito: "seg – sex · 60 min" | "todo dia · até 05:30".
export function habitSubline(h: HabitDto): string {
  const days = h.weekdays.length === 7 ? "todo dia" : h.weekdays.length === 5 && !h.weekdays.includes(6) && !h.weekdays.includes(7) ? "seg – sex" : h.weekdays.map((d) => ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"][d]).join(" ");
  const target = h.kind === "TIME" && h.targetTime ? `até ${h.targetTime}` : h.targetValue != null ? `${h.targetValue} ${h.unit ?? ""}`.trim() : "";
  return [days, target].filter(Boolean).join(" · ");
}
