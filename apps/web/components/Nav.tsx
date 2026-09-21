"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SketchLine } from "./sketch";

const items = [
  ["/", "Hoje"], ["/financeiro", "Financeiro"], ["/habitos", "Hábitos"], ["/metas", "Metas"], ["/midia", "Mídia"],
] as const;

/** Data de hoje só depois da montagem: evita divergir do relógio do servidor. */
function TodayLabel() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const now = new Date();
    const weekday = now.toLocaleDateString("pt-BR", { weekday: "long" });
    setLabel(`${weekday} · ${now.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "")}`);
  }, []);
  return <span className="ml-auto text-sm muted">{label}</span>;
}

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="mx-auto flex max-w-6xl flex-col justify-end px-12">
      <div className="flex h-[52px] items-center gap-9">
        <span className="text-2xl">Índice</span>
        <nav aria-label="Principal" className="flex gap-6">
          {items.map(([href, label]) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className="relative px-0.5 py-1" style={{ color: active ? "var(--fg)" : "var(--muted)" }}>
                {label}
                {active && <span className="absolute -bottom-1 left-0 right-0 block"><SketchLine strokeWidth={2} /></span>}
              </Link>
            );
          })}
        </nav>
        <TodayLabel />
      </div>
      <SketchLine strokeWidth={1.4} />
    </header>
  );
}
