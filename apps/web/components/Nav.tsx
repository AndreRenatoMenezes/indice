import Link from "next/link";

const items = [
  ["/", "Hoje"], ["/financeiro", "Financeiro"], ["/habitos", "Hábitos"], ["/metas", "Metas"], ["/midia", "Mídia"],
] as const;

export function Nav() {
  return (
    <header className="border-b" style={{ borderColor: "var(--line)" }}>
      <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">Índice</span>
        <ul className="flex gap-4 text-sm">
          {items.map(([href, label]) => (
            <li key={href}><Link href={href} className="muted hover:underline">{label}</Link></li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
