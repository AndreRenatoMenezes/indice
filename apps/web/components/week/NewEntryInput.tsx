"use client";

// Campo no pé de cada dia/lista, como no WeekToDo: Enter cria e o campo fica
// pronto para a próxima; Esc limpa; texto vazio é ignorado.
import { useState } from "react";

export function NewEntryInput({ onCreate, label, placeholder = "+ nova" }: { onCreate: (text: string) => void; label: string; placeholder?: string }) {
  const [text, setText] = useState("");
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          const t = text.trim();
          if (t) onCreate(t);
          setText("");
        } else if (e.key === "Escape") {
          if (text) e.preventDefault(); // limpa o campo sem fechar o painel
          setText("");
        }
      }}
      placeholder={placeholder}
      aria-label={`nova tarefa em ${label}`}
      className="input mt-2 w-full border-b border-dashed border-transparent px-0 text-[15px] focus:border-[var(--line)]"
    />
  );
}
