"use client";

// Notas da tarefa: markdown simples. Lendo, mostra formatado (react-markdown,
// sem HTML cru: `<script>` digitado aparece como texto); editando, textarea
// que grava ao sair.
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export function Notes({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const cancelled = useRef(false);
  useEffect(() => { if (!editing) setText(value ?? ""); }, [value, editing]);

  const save = () => {
    setEditing(false);
    if (cancelled.current) { cancelled.current = false; return; }
    const next = text.trim() ? text : null;
    if (next !== (value ?? null)) onSave(next);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); cancelled.current = true; setText(value ?? ""); setEditing(false); }
          }}
          rows={6}
          aria-label="notas"
          className="input min-h-32 w-full resize-y rounded border border-dashed border-[var(--line)] bg-[var(--card)] px-3 py-2 text-[15px] leading-[1.5]"
        />
        <span className="text-xs text-[var(--ink-faint)]">**negrito** · *itálico* · - lista · [link](https://…) — grava ao sair</span>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { cancelled.current = false; setEditing(true); }}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); cancelled.current = false; setEditing(true); } }}
      title="editar notas"
      className="min-h-10 cursor-text rounded px-1 py-1 text-[15px] leading-[1.5] hover:bg-[var(--paper-raised)] [&_a]:text-[var(--accent)] [&_a]:underline [&_code]:rounded [&_code]:bg-[var(--rule-soft)] [&_code]:px-1 [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-base [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
    >
      {value ? (
        <ReactMarkdown components={{ a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} /> }}>
          {value}
        </ReactMarkdown>
      ) : (
        <span className="font-display italic muted">Sem notas. Clique para escrever.</span>
      )}
    </div>
  );
}
