"use client";

// Subtarefas no painel: criar (Enter), marcar, editar (duplo clique),
// reordenar (arrastar, com `DndContext` próprio) e apagar. A ordem final é a do
// servidor: concluídas descem para o fim, e só as abertas sem hora se arrastam.
import { useState } from "react";
import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { EntryDto } from "@indice/shared";
import { InlineEdit, glyph } from "./EntryRow";
import { NewEntryInput } from "./NewEntryInput";
import { isManual } from "./weekState";

export type SubtaskOps = {
  create: (parent: EntryDto, text: string) => void;
  toggle: (child: EntryDto) => void;
  rename: (child: EntryDto, text: string) => void;
  move: (parent: EntryDto, child: EntryDto, beforeId: string | null) => void;
  remove: (parent: EntryDto, child: EntryDto) => void;
};

function SubtaskRow({ parent, child, ops }: { parent: EntryDto; child: EntryDto; ops: SubtaskOps }) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: child.id,
    disabled: { draggable: !isManual(child) || editing, droppable: false },
  });
  const done = child.status === "DONE";
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="subtarefa arrastável"
      // A linha tem controles próprios (marcador, edição): "não arrasta" não é "desabilitada".
      aria-disabled={undefined}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : undefined, WebkitTouchCallout: "none" }}
      className="group -mx-1 flex items-baseline gap-2.5 rounded px-1 py-0.5 outline-none focus-visible:bg-[var(--paper-raised)] focus-visible:ring-1 focus-visible:ring-[var(--line)]"
    >
      <button
        type="button"
        onClick={() => ops.toggle(child)}
        className="w-3.5 flex-none cursor-pointer text-sm"
        style={{ color: done ? "var(--green)" : undefined }}
        title={done ? "reabrir" : "concluir"}
        aria-label={`${done ? "reabrir" : "concluir"} ${child.text}`}
      >
        {glyph(child) || "•"}
      </button>
      {editing ? (
        <InlineEdit value={child.text} onSave={(t) => ops.rename(child, t)} onDone={() => setEditing(false)} className="text-[15px]" />
      ) : (
        <span
          className={`flex-1 select-none text-[15px] ${done ? "muted line-through decoration-[var(--ink-faint)]" : ""}`}
          onDoubleClick={() => setEditing(true)}
          title="duplo clique para editar"
        >
          {child.text}
        </span>
      )}
      {child.time && <span className="label tracking-[0.16em] text-[var(--ink-faint)]">{child.time}</span>}
      <button
        type="button"
        onClick={() => ops.remove(parent, child)}
        aria-label={`apagar ${child.text}`}
        className="flex-none cursor-pointer text-[var(--ink-faint)] opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        ×
      </button>
    </li>
  );
}

export function SubtaskList({ parent, ops }: { parent: EntryDto; ops: SubtaskOps }) {
  const children = parent.children ?? [];
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = children.findIndex((c) => c.id === active.id);
    const to = children.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    // Mesma semântica do arrayMove: descendo, fica depois do alvo.
    const beforeId = from < to ? (children[to + 1]?.id ?? null) : children[to]!.id;
    ops.move(parent, children[from]!, beforeId);
  };

  const done = children.filter((c) => c.status === "DONE").length;
  return (
    <div>
      <div className="label mb-1.5">Subtarefas{children.length ? ` · ${done}/${children.length}` : ""}</div>
      <DndContext id={`subtarefas-${parent.id}`} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1">
            {children.map((c) => <SubtaskRow key={c.id} parent={parent} child={c} ops={ops} />)}
          </ul>
        </SortableContext>
      </DndContext>
      <NewEntryInput onCreate={(text) => ops.create(parent, text)} label="subtarefas" placeholder="+ subtarefa" />
    </div>
  );
}
