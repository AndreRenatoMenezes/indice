"use client";

// Aviso no pé da tela: falha de gravação ("voltei ao estado anterior") ou
// confirmação com "desfazer". Some sozinho em 6 s.
import { useEffect } from "react";
import { Sketch } from "../sketch";
import { PALETTE } from "../palette";

export type ToastData = { id: number; message: string; undo?: () => void; tone?: "error" | "info" };

export function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div key={toast.id} className="relative flex max-w-[520px] items-center gap-4 px-5 py-3 text-[15px]">
        <Sketch radius={8} fill={toast.tone === "error" ? PALETTE.red[0] : "var(--card)"} />
        <span className="relative">{toast.message}</span>
        {toast.undo && (
          <button
            className="relative cursor-pointer font-display text-[13px] uppercase tracking-[0.16em] text-[var(--accent)]"
            onClick={() => { toast.undo?.(); onClose(); }}
          >
            desfazer
          </button>
        )}
        <button className="relative cursor-pointer text-[var(--ink-faint)]" aria-label="fechar aviso" onClick={onClose}>×</button>
      </div>
    </div>
  );
}
