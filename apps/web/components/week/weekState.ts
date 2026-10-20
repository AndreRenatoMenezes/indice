// Estado da semana no cliente e o reducer das mudanças otimistas. Módulo puro
// (sem React): o `WeekBoard` aplica estas ações na hora, a Server Action grava
// e o revalidate devolve a verdade do servidor, que substitui tudo. Por isso o
// reducer é mínimo: não reimplementa a ordem (regra 1B mora na API), só põe o
// item num lugar plausível até a resposta chegar.
import type { CustomListDto, EntryDto, RecurrenceRuleDto } from "@indice/shared";

export type WeekState = {
  /** Raízes de cada dia visível (com `children`), na ordem do servidor. */
  days: Record<string, EntryDto[]>;
  lists: CustomListDto[];
  rules: RecurrenceRuleDto[];
};

/** Onde uma raiz mora: um dia ou uma lista personalizada. */
export type Place = { kind: "day"; date: string } | { kind: "list"; id: string };

/** Chave do lugar para o arrastar (mesmo espaço de ids das entradas, que são uuids). */
export const placeKey = (p: Place) => (p.kind === "day" ? `day:${p.date}` : `list:${p.id}`);
export function parsePlaceKey(key: string): Place | null {
  if (key.startsWith("day:")) return { kind: "day", date: key.slice(4) };
  if (key.startsWith("list:")) return { kind: "list", id: key.slice(5) };
  return null;
}
export const samePlace = (a: Place, b: Place) => placeKey(a) === placeKey(b);

export const isClosed = (e: Pick<EntryDto, "status">) => e.status === "DONE" || e.status === "CANCELLED" || e.status === "MIGRATED";
export const isManual = (e: Pick<EntryDto, "status" | "time">) => e.status === "OPEN" && e.time == null;
/** Só raiz aberta sai do lugar (arrastar, mudar de dia, adiar). */
export const canMove = (e: Pick<EntryDto, "status" | "parentId">) => e.status === "OPEN" && e.parentId == null;

export type WeekAction =
  | { type: "create"; place: Place; entry: EntryDto; beforeId?: string | null }
  | { type: "createChild"; parentId: string; entry: EntryDto }
  | { type: "update"; ids: string[]; patch: Partial<EntryDto> }
  | { type: "remove"; ids: string[] }
  | { type: "move"; id: string; to: Place; beforeId: string | null; copyId: string }
  | { type: "moveChild"; parentId: string; id: string; beforeId: string | null }
  | { type: "createList"; list: CustomListDto }
  | { type: "updateList"; id: string; patch: Partial<Pick<CustomListDto, "name" | "color">> }
  | { type: "reorderLists"; ids: string[] }
  | { type: "removeList"; id: string }
  | { type: "stopRule"; ruleId: string; today: string }
  | { type: "addRule"; entryId: string; rule: RecurrenceRuleDto };

// ── leitura ─────────────────────────────────────────────────────────────────

export function rootsAt(state: WeekState, place: Place): EntryDto[] | undefined {
  return place.kind === "day" ? state.days[place.date] : state.lists.find((l) => l.id === place.id)?.entries;
}

/** Raiz ou subtarefa pelo id, com o lugar da raiz e a mãe (se for subtarefa). */
export function findEntry(state: WeekState, id: string): { entry: EntryDto; place: Place; parent: EntryDto | null } | null {
  const places: [Place, EntryDto[]][] = [
    ...Object.entries(state.days).map(([date, list]): [Place, EntryDto[]] => [{ kind: "day", date }, list]),
    ...state.lists.map((l): [Place, EntryDto[]] => [{ kind: "list", id: l.id }, l.entries]),
  ];
  for (const [place, list] of places) {
    for (const root of list) {
      if (root.id === id) return { entry: root, place, parent: null };
      const child = root.children?.find((c) => c.id === id);
      if (child) return { entry: child, place, parent: root };
    }
  }
  return null;
}

/** Todas as raízes visíveis (dias e listas). */
export const allRoots = (state: WeekState) => [...Object.values(state.days).flat(), ...state.lists.flatMap((l) => l.entries)];

// ── escrita ─────────────────────────────────────────────────────────────────

function mapPlaces(state: WeekState, fn: (list: EntryDto[], place: Place) => EntryDto[]): WeekState {
  const days: Record<string, EntryDto[]> = {};
  for (const [date, list] of Object.entries(state.days)) days[date] = fn(list, { kind: "day", date });
  return { ...state, days, lists: state.lists.map((l) => ({ ...l, entries: fn(l.entries, { kind: "list", id: l.id }) })) };
}

function withPlace(state: WeekState, place: Place, fn: (list: EntryDto[]) => EntryDto[]): WeekState {
  if (place.kind === "day") return state.days[place.date] ? { ...state, days: { ...state.days, [place.date]: fn(state.days[place.date]!) } } : state;
  return { ...state, lists: state.lists.map((l) => (l.id === place.id ? { ...l, entries: fn(l.entries) } : l)) };
}

/** Põe antes de `beforeId` se ele estiver na lista; senão no fim das abertas (antes das fechadas). */
export function insertBefore(list: EntryDto[], entry: EntryDto, beforeId?: string | null): EntryDto[] {
  let at = beforeId ? list.findIndex((e) => e.id === beforeId) : -1;
  if (at < 0) at = list.findIndex(isClosed);
  if (at < 0) at = list.length;
  return [...list.slice(0, at), entry, ...list.slice(at)];
}

const mapEntries = (list: EntryDto[], fn: (e: EntryDto) => EntryDto): EntryDto[] =>
  list.map((e) => fn({ ...e, children: e.children?.map(fn) }));

export function weekReducer(state: WeekState, action: WeekAction): WeekState {
  switch (action.type) {
    case "create":
      return withPlace(state, action.place, (list) => insertBefore(list, action.entry, action.beforeId));

    case "createChild":
      return mapPlaces(state, (list) =>
        list.map((e) => (e.id === action.parentId ? { ...e, children: [...(e.children ?? []).filter((c) => !isClosed(c)), action.entry, ...(e.children ?? []).filter(isClosed)] } : e)),
      );

    case "update": {
      const ids = new Set(action.ids);
      return mapPlaces(state, (list) => mapEntries(list, (e) => (ids.has(e.id) ? { ...e, ...action.patch } : e)));
    }

    case "remove": {
      const ids = new Set(action.ids);
      return mapPlaces(state, (list) =>
        list.filter((e) => !ids.has(e.id)).map((e) => (e.children?.some((c) => ids.has(c.id)) ? { ...e, children: e.children.filter((c) => !ids.has(c.id)) } : e)),
      );
    }

    case "move": {
      const found = findEntry(state, action.id);
      if (!found || found.parent) return state;
      const { entry, place: from } = found;
      // Mesmo lugar: só as manuais mudam de posição (a hora define a ordem das outras).
      if (samePlace(from, action.to)) {
        if (!isManual(entry) || action.beforeId === entry.id) return state;
        return withPlace(state, from, (list) => {
          const rest = list.filter((e) => e.id !== entry.id);
          const target = rest.find((e) => e.id === action.beforeId);
          return insertBefore(rest, entry, target && isManual(target) ? target.id : null);
        });
      }
      if (!canMove(entry)) return state;
      // Sair de um dia deixa o rastro › e uma cópia com as subtarefas abertas;
      // sair de uma lista leva a própria tarefa, sem rastro.
      if (from.kind === "day") {
        const copy: EntryDto = {
          ...entry, id: action.copyId, recurrenceRuleId: null, position: Number.MAX_SAFE_INTEGER,
          date: action.to.kind === "day" ? action.to.date : null,
          children: entry.children?.filter((c) => c.status === "OPEN").map((c) => ({ ...c, id: `${action.copyId}:${c.id}`, parentId: action.copyId })),
        };
        const traced = withPlace(state, from, (list) => list.map((e) => (e.id === entry.id ? { ...e, status: "MIGRATED" as const } : e)));
        return withPlace(traced, action.to, (list) => insertBefore(list, copy, action.beforeId));
      }
      const moved = { ...entry, date: action.to.kind === "day" ? action.to.date : null };
      const removed = withPlace(state, from, (list) => list.filter((e) => e.id !== entry.id));
      return withPlace(removed, action.to, (list) => insertBefore(list, moved, action.beforeId));
    }

    case "moveChild":
      return mapPlaces(state, (list) =>
        list.map((e) => {
          if (e.id !== action.parentId || !e.children) return e;
          const child = e.children.find((c) => c.id === action.id);
          if (!child || child.status !== "OPEN" || child.time != null) return e;
          return { ...e, children: insertBefore(e.children.filter((c) => c.id !== action.id), child, action.beforeId) };
        }),
      );

    case "createList":
      return { ...state, lists: [...state.lists, action.list] };

    case "updateList":
      return { ...state, lists: state.lists.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)) };

    case "reorderLists": {
      const order = new Map(action.ids.map((id, i) => [id, i]));
      return { ...state, lists: [...state.lists].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)) };
    }

    case "removeList":
      return { ...state, lists: state.lists.filter((l) => l.id !== action.id) };

    case "addRule": {
      const linked = mapPlaces(state, (list) => list.map((e) => (e.id === action.entryId ? { ...e, recurrenceRuleId: action.rule.id } : e)));
      return { ...linked, rules: [...linked.rules, action.rule] };
    }

    case "stopRule": {
      // Parar some com as ocorrências futuras abertas e solta a regra das demais.
      const stopped = mapPlaces(state, (list) =>
        list
          .filter((e) => !(e.recurrenceRuleId === action.ruleId && e.status === "OPEN" && e.date != null && e.date >= action.today))
          .map((e) => (e.recurrenceRuleId === action.ruleId ? { ...e, recurrenceRuleId: null } : e)),
      );
      return { ...stopped, rules: stopped.rules.filter((r) => r.id !== action.ruleId) };
    }
  }
}

// ── rascunhos ───────────────────────────────────────────────────────────────

/** Entrada otimista com os campos mínimos; o servidor devolve a definitiva no revalidate. */
export function draftEntry(fields: Pick<EntryDto, "id" | "text"> & Partial<EntryDto>): EntryDto {
  return {
    collectionId: "", parentId: null, kind: "TASK", status: "OPEN", description: null, date: null, time: null, alarm: false,
    priority: 0, color: null, tags: [], position: Number.MAX_SAFE_INTEGER, goalId: null, mediaItemId: null, recurrenceRuleId: null,
    children: [], ...fields,
  };
}

/** Texto para a área de transferência: a tarefa e as subtarefas como checklist. */
export function entryAsText(e: EntryDto, indent = ""): string {
  const mark = e.status === "DONE" ? "[x]" : "[ ]";
  const lines = [`${indent}- ${mark} ${e.text}${e.time ? ` (${e.time})` : ""}`];
  for (const c of e.children ?? []) lines.push(`${indent}  - ${c.status === "DONE" ? "[x]" : "[ ]"} ${c.text}`);
  return lines.join("\n");
}

/** "Quarta, 24/09" + um item por tarefa (sem os rastros ›), subtarefas indentadas. */
export function listAsText(title: string, entries: EntryDto[]): string {
  return [title, ...entries.filter((e) => e.status !== "MIGRATED").map((e) => entryAsText(e))].join("\n");
}
