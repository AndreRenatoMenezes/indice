"use server";
// Server Actions: o browser nunca fala com a API diretamente.
import { revalidatePath } from "next/cache";
import { api } from "./api";

export async function toggleEntry(id: string, done: boolean) {
  await api(`/entries/${id}`, { method: "PATCH", body: JSON.stringify({ status: done ? "DONE" : "OPEN" }) });
  revalidatePath("/");
}

export async function addEntry(formData: FormData) {
  const text = String(formData.get("text") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!text) return;
  await api("/entries", { method: "POST", body: JSON.stringify({ text, date: date || undefined, source: "WEB" }) });
  revalidatePath("/");
}

export async function migrateEntry(id: string, date: string) {
  await api(`/entries/${id}/migrate`, { method: "POST", body: JSON.stringify({ date }) });
  revalidatePath("/");
}

export async function logHabit(habitId: string, done: boolean, date?: string) {
  if (done) await api(`/habits/${habitId}/log`, { method: "PUT", body: JSON.stringify({ date, source: "WEB" }) });
  else await api(`/habits/${habitId}/log${date ? `?date=${date}` : ""}`, { method: "DELETE" });
  revalidatePath("/");
  revalidatePath("/habitos");
}

export async function addTransaction(formData: FormData) {
  const payload = {
    type: String(formData.get("type") ?? "EXPENSE"),
    date: String(formData.get("date")),
    amount: Number(formData.get("amount")),
    description: String(formData.get("description") ?? ""),
    paymentMethod: String(formData.get("paymentMethod") || "") || undefined,
    source: "WEB",
  };
  await api("/transactions", { method: "POST", body: JSON.stringify(payload) });
  revalidatePath("/financeiro");
  revalidatePath("/");
}

export async function addMedia(formData: FormData) {
  await api("/media", { method: "POST", body: JSON.stringify({ kind: String(formData.get("kind")), title: String(formData.get("title")), creator: String(formData.get("creator") || "") || undefined, status: String(formData.get("status") || "WISHLIST") }) });
  revalidatePath("/midia");
}

export async function addGoalContribution(goalId: string, formData: FormData) {
  await api(`/goals/${goalId}/contributions`, { method: "POST", body: JSON.stringify({ amount: Number(formData.get("amount")), note: String(formData.get("note") || "") || undefined }) });
  revalidatePath("/metas");
  revalidatePath("/");
}
