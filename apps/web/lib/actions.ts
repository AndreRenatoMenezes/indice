"use server";
// Server Actions: o browser nunca fala com a API diretamente.
import { revalidatePath } from "next/cache";
import type {
  CreateEntryInput, CreateListInput, CustomListDto, EntryBatchInput, EntryDto, MoveEntryInput, RecurrenceInput,
  RecurrenceRuleDto, UpdateEntryInput, UpdateListInput,
} from "@indice/shared";
import { api } from "./api";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || undefined;
const numOpt = (fd: FormData, k: string) => (str(fd, k) ? Number(str(fd, k).replace(",", ".")) : undefined);

function refreshAll() {
  for (const p of ["/", "/financeiro", "/habitos", "/metas", "/midia"]) revalidatePath(p);
}

// ── Journal ────────────────────────────────────────────────────────────────
// Diário e Semana mostram os mesmos bullets: toda action de journal revalida os dois.
function revalidateJournal() {
  revalidatePath("/");
  revalidatePath("/semana");
}

const json = (body: unknown) => JSON.stringify(body);

export async function toggleEntry(id: string, done: boolean) {
  await api(`/entries/${id}`, { method: "PATCH", body: json({ status: done ? "DONE" : "OPEN" }) });
  revalidateJournal();
}

export async function addEntry(formData: FormData) {
  const text = str(formData, "text");
  if (!text) return;
  await api("/entries", { method: "POST", body: json({ text, date: opt(formData, "date"), kind: opt(formData, "kind") ?? "TASK", time: opt(formData, "time"), source: "WEB" }) });
  revalidateJournal();
}

export async function migrateEntry(id: string, date: string) {
  await api(`/entries/${id}/migrate`, { method: "POST", body: json({ date }) });
  revalidateJournal();
}

export async function deleteEntry(id: string) {
  await api(`/entries/${id}`, { method: "DELETE" });
  revalidateJournal();
}

export async function upsertDailyLog(formData: FormData) {
  const date = str(formData, "date");
  await api(`/daily-log/${date}`, { method: "PUT", body: json({ wokeAt: opt(formData, "wokeAt"), mood: numOpt(formData, "mood"), energy: numOpt(formData, "energy"), sleepHours: numOpt(formData, "sleepHours"), highlights: opt(formData, "highlights") }) });
  revalidateJournal();
}

// Chamadas de componentes client (Semana), com argumentos tipados. Erro da API
// lança: quem chama descarta o estado otimista e avisa.
export async function createEntry(input: CreateEntryInput): Promise<EntryDto> {
  const created = await api<EntryDto>("/entries", { method: "POST", body: json({ source: "WEB", ...input }) });
  revalidateJournal();
  return created;
}

export async function updateEntry(id: string, patch: UpdateEntryInput): Promise<EntryDto> {
  const updated = await api<EntryDto>(`/entries/${id}`, { method: "PATCH", body: json(patch) });
  revalidateJournal();
  return updated;
}

export async function moveEntry(id: string, input: MoveEntryInput): Promise<EntryDto> {
  const moved = await api<EntryDto>(`/entries/${id}/move`, { method: "POST", body: json(input) });
  revalidateJournal();
  return moved;
}

export async function batchEntries(input: EntryBatchInput): Promise<{ ids: string[] }> {
  const r = await api<{ ids: string[] }>("/entries/batch", { method: "POST", body: json(input) });
  revalidateJournal();
  return r;
}

export async function duplicateEntry(id: string): Promise<EntryDto> {
  const copy = await api<EntryDto>(`/entries/${id}/duplicate`, { method: "POST", body: "{}" });
  revalidateJournal();
  return copy;
}

export async function setRecurrence(id: string, input: RecurrenceInput): Promise<RecurrenceRuleDto> {
  const rule = await api<RecurrenceRuleDto>(`/entries/${id}/recurrence`, { method: "PUT", body: json(input) });
  revalidateJournal();
  return rule;
}

export async function stopRecurrence(ruleId: string) {
  await api(`/recurrence-rules/${ruleId}`, { method: "DELETE" });
  revalidateJournal();
}

export async function createList(input: CreateListInput): Promise<CustomListDto> {
  const list = await api<CustomListDto>("/lists", { method: "POST", body: json(input) });
  revalidateJournal();
  return list;
}

export async function updateList(id: string, input: UpdateListInput): Promise<CustomListDto> {
  const list = await api<CustomListDto>(`/lists/${id}`, { method: "PATCH", body: json(input) });
  revalidateJournal();
  return list;
}

export async function reorderLists(ids: string[]) {
  await api("/lists/order", { method: "PUT", body: json({ ids }) });
  revalidateJournal();
}

export async function deleteList(id: string) {
  await api(`/lists/${id}`, { method: "DELETE" });
  revalidateJournal();
}

// ── Hábitos ────────────────────────────────────────────────────────────────
export async function logHabit(habitId: string, done: boolean, date?: string) {
  if (done) await api(`/habits/${habitId}/log`, { method: "PUT", body: JSON.stringify({ date, source: "WEB" }) });
  else await api(`/habits/${habitId}/log${date ? `?date=${date}` : ""}`, { method: "DELETE" });
  revalidatePath("/");
  revalidatePath("/habitos");
}

// Registro com valor (COUNTER/DURATION) ou horário (TIME).
export async function logHabitValue(formData: FormData) {
  const habitId = str(formData, "habitId");
  await api(`/habits/${habitId}/log`, { method: "PUT", body: JSON.stringify({ date: opt(formData, "date"), value: numOpt(formData, "value"), time: opt(formData, "time"), source: "WEB" }) });
  revalidatePath("/");
  revalidatePath("/habitos");
}

export async function addHabit(formData: FormData) {
  const weekdays = formData.getAll("weekdays").map(Number).filter((n) => n >= 1 && n <= 7);
  await api("/habits", { method: "POST", body: JSON.stringify({
    name: str(formData, "name"), kind: str(formData, "kind") || "BOOLEAN", unit: opt(formData, "unit"),
    targetValue: numOpt(formData, "targetValue"), targetTime: opt(formData, "targetTime"), weekdays: weekdays.length ? weekdays : undefined,
  }) });
  revalidatePath("/habitos");
  revalidatePath("/");
}

// ── Financeiro ─────────────────────────────────────────────────────────────
export async function addTransaction(formData: FormData) {
  const type = str(formData, "type") || "EXPENSE";
  const creditCardId = opt(formData, "creditCardId");
  const paymentMethod = creditCardId ? "CREDIT" : opt(formData, "paymentMethod");
  await api("/transactions", { method: "POST", body: JSON.stringify({
    type, date: str(formData, "date"), amount: numOpt(formData, "amount"), description: str(formData, "description"),
    categoryId: opt(formData, "categoryId"), paymentMethod, accountId: creditCardId ? undefined : opt(formData, "accountId"),
    toAccountId: opt(formData, "toAccountId"), creditCardId, source: "WEB",
  }) });
  refreshAll();
}

export async function deleteTransaction(id: string) {
  await api(`/transactions/${id}`, { method: "DELETE" });
  refreshAll();
}

export async function payInvoice(id: string, formData: FormData) {
  await api(`/invoices/${id}/pay`, { method: "POST", body: JSON.stringify({ accountId: str(formData, "accountId"), amount: numOpt(formData, "amount"), date: opt(formData, "date") }) });
  refreshAll();
}

// ── Metas ──────────────────────────────────────────────────────────────────
export async function addGoal(formData: FormData) {
  await api("/goals", { method: "POST", body: JSON.stringify({
    title: str(formData, "title"), kind: str(formData, "kind") || "FINANCIAL", targetValue: numOpt(formData, "targetValue") ?? 0,
    unit: opt(formData, "unit"), targetDate: opt(formData, "targetDate"), priority: numOpt(formData, "priority"), description: opt(formData, "description"),
  }) });
  revalidatePath("/metas");
  revalidatePath("/");
}

export async function updateGoal(id: string, patch: { status?: string; targetValue?: number; priority?: number }) {
  await api(`/goals/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  revalidatePath("/metas");
  revalidatePath("/");
}

export async function setGoalTarget(id: string, formData: FormData) {
  await updateGoal(id, { targetValue: numOpt(formData, "targetValue") });
}

export async function addGoalContribution(goalId: string, formData: FormData) {
  await api(`/goals/${goalId}/contributions`, { method: "POST", body: JSON.stringify({ amount: numOpt(formData, "amount"), note: opt(formData, "note"), date: opt(formData, "date") }) });
  revalidatePath("/metas");
  revalidatePath("/");
}

// ── Mídia ──────────────────────────────────────────────────────────────────
export async function addMedia(formData: FormData) {
  await api("/media", { method: "POST", body: JSON.stringify({
    kind: str(formData, "kind"), title: str(formData, "title"), creator: opt(formData, "creator"), platform: opt(formData, "platform"),
    status: str(formData, "status") || "WISHLIST", progressTotal: numOpt(formData, "progressTotal"), progressUnit: opt(formData, "progressUnit"),
  }) });
  revalidatePath("/midia");
  revalidatePath("/");
}

export async function updateMedia(id: string, patch: { status?: string; rating?: number; progress?: number }) {
  await api(`/media/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  revalidatePath("/midia");
  revalidatePath("/");
}

export async function setMediaProgress(id: string, formData: FormData) {
  await updateMedia(id, { progress: numOpt(formData, "progress"), rating: numOpt(formData, "rating") });
}
