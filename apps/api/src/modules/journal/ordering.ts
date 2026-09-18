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
