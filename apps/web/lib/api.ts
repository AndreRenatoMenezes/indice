// Cliente da API para Server Components. A chave fica no servidor (env sem
// NEXT_PUBLIC_), nunca chega ao navegador.
import type { DailySummaryDto, GoalProgressDto, MediaItemDto, TransactionDto, HabitTodayDto } from "@indice/shared";

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
export const getAccounts = () => api<{ accounts: Array<{ id: string; name: string; kind: string; institution: string | null; balance: number }>; unassigned: number }>("/accounts");
export const getInvoices = () => api<{ invoices: Array<{ id: string; institution: string; refYear: number; refMonth: number; dueDate: string; total: number; status: string; purchases: number }> }>("/invoices");
export const getHabitsToday = () => api<{ date: string; habits: HabitTodayDto[] }>("/habits/today");
export const getGoals = () => api<{ goals: GoalProgressDto[] }>("/goals");
export const getMedia = () => api<{ items: MediaItemDto[] }>("/media");

export const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
export const dateBR = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
