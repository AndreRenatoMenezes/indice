// Portado de weektodo-journal/src/helpers/tasksHelper.js.
// Pendentes antes de concluídas; com hora antes de sem hora; hora crescente; depois posição.
export type Orderable = { status: string; time: string | null; position: number };

export function sortEntries<T extends Orderable>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aDone = a.status === "DONE" || a.status === "CANCELLED" || a.status === "MIGRATED";
    const bDone = b.status === "DONE" || b.status === "CANCELLED" || b.status === "MIGRATED";
    if (aDone !== bDone) return aDone ? 1 : -1;
    if ((a.time == null) !== (b.time == null)) return a.time == null ? 1 : -1;
    if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
    return a.position - b.position;
  });
}

// O mesmo critério de "fechada" do `sortEntries`.
export function isClosed(e: { status: string }): boolean {
  return e.status === "DONE" || e.status === "CANCELLED" || e.status === "MIGRATED";
}

// Só o que está aberto e sem hora tem ordem escolhida à mão (regra 1B): a hora
// ordena as demais, e as fechadas descem para o fim.
export function isManual(e: { status: string; time: string | null }): boolean {
  return e.status === "OPEN" && e.time == null;
}

// Onde fica o item solto entre as irmãs (ele incluído). Soltar antes de uma
// manual encaixa ali; antes de uma com hora, de uma fechada ou no vazio
// (`beforeId` nulo), vai para o fim das manuais. Renumera 0..n-1 na ordem de
// exibição e devolve só as posições que mudaram; item com hora ou fechado não
// se move (devolve []).
export function reposition<T extends Orderable & { id: string }>(
  siblings: T[],
  movingId: string,
  beforeId: string | null | undefined,
): { id: string; position: number }[] {
  const moving = siblings.find((s) => s.id === movingId);
  if (!moving || !isManual(moving)) return [];
  const others = sortEntries(siblings.filter((s) => s.id !== movingId));
  const before = beforeId ? others.findIndex((s) => s.id === beforeId) : -1;
  let at: number;
  if (before >= 0 && isManual(others[before]!)) at = before;
  else {
    at = others.findIndex(isClosed);
    if (at < 0) at = others.length;
  }
  const ordered = [...others.slice(0, at), moving, ...others.slice(at)];
  return ordered.flatMap((s, i) => (s.position === i ? [] : [{ id: s.id, position: i }]));
}
