import Link from "next/link";
import { getMedia, dateBR, MEDIA_KIND_LABEL, MEDIA_STATUS_LABEL } from "@/lib/api";
import { addMedia, setMediaProgress, updateMedia } from "@/lib/actions";
import { Card, Empty, Progress } from "@/components/ui";

export const dynamic = "force-dynamic";

const FILTERS = [["", "Todos"], ["BOOK", "Livros"], ["GAME", "Jogos"], ["COURSE", "Cursos"], ["MOVIE", "Filmes"], ["SERIES", "Séries"]] as const;
const GROUPS = ["IN_PROGRESS", "WISHLIST", "PAUSED", "DONE", "DROPPED"] as const;

export default async function Midia({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = "" } = await searchParams;
  const { items } = await getMedia(kind ? `?kind=${kind}` : "");

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-4">
        <div className="flex gap-2 text-sm">
          {FILTERS.map(([v, l]) => <Link key={v} href={v ? `/midia?kind=${v}` : "/midia"} className="btn" style={v === kind ? { background: "var(--accent)", borderColor: "var(--accent)", color: "white" } : undefined}>{l}</Link>)}
        </div>
        {GROUPS.map((g) => {
          const list = items.filter((i) => i.status === g);
          if (!list.length) return null;
          return (
            <Card key={g} title={MEDIA_STATUS_LABEL[g]}>
              <ul className="grid gap-3 text-sm">
                {list.map((m) => {
                  const pct = m.progress != null && m.progressTotal ? (m.progress / m.progressTotal) * 100 : null;
                  return (
                    <li key={m.id} className="border-t pt-3 first:border-t-0 first:pt-0" style={{ borderColor: "var(--line)" }}>
                      <div className="flex items-start gap-3">
                        <span className="mono rounded px-1.5 py-0.5 text-[10px] uppercase" style={{ background: "var(--line)" }}>{MEDIA_KIND_LABEL[m.kind]}</span>
                        <div className="flex-1">
                          <div className="font-medium">{m.title}</div>
                          <div className="text-xs muted">{[m.creator, m.platform, m.year].filter(Boolean).join(" · ")}</div>
                          <div className="mt-1 text-xs muted">
                            {pct != null ? `${m.progress} de ${m.progressTotal} ${m.progressUnit ?? ""} · ${pct.toFixed(0)}%` : m.status === "DONE" ? `terminado em ${dateBR(m.finishedAt)}` : m.startedAt ? `desde ${dateBR(m.startedAt)}` : ""}
                            {m.rating ? ` · ${m.rating}/10` : ""}
                          </div>
                          {pct != null && <div className="mt-1"><Progress pct={pct} /></div>}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        {m.status !== "IN_PROGRESS" && m.status !== "DONE" && <form action={updateMedia.bind(null, m.id, { status: "IN_PROGRESS" })}><button className="btn">Começar</button></form>}
                        {m.status === "IN_PROGRESS" && <form action={updateMedia.bind(null, m.id, { status: "PAUSED" })}><button className="btn">Pausar</button></form>}
                        {m.status !== "DONE" && <form action={updateMedia.bind(null, m.id, { status: "DONE" })}><button className="btn">Concluir</button></form>}
                        {m.status !== "DROPPED" && m.status !== "DONE" && <form action={updateMedia.bind(null, m.id, { status: "DROPPED" })}><button className="btn">Abandonar</button></form>}
                        <form action={setMediaProgress.bind(null, m.id)} className="ml-auto flex gap-1">
                          {m.status === "IN_PROGRESS" && <input name="progress" type="number" step="any" min="0" placeholder={m.progressUnit ?? "progresso"} className="input w-24" />}
                          <input name="rating" type="number" min="1" max="10" placeholder="nota" className="input w-16" />
                          <button className="btn">Salvar</button>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
        {!items.length && <Empty>Arquivo vazio.</Empty>}
      </div>

      <div className="grid gap-4 content-start">
        <Card title="Novo item">
          <form action={addMedia} className="grid gap-2 text-sm">
            <select name="kind" className="input" defaultValue={kind || "BOOK"}>{Object.entries(MEDIA_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <input name="title" required placeholder="título" className="input" />
            <input name="creator" placeholder="autor / estúdio / instituição" className="input" />
            <input name="platform" placeholder="plataforma (Kindle, PS5, físico)" className="input" />
            <div className="grid grid-cols-2 gap-2">
              <input name="progressTotal" type="number" step="any" min="0" placeholder="total (320)" className="input" />
              <input name="progressUnit" placeholder="unidade (páginas, h, %)" className="input" />
            </div>
            <select name="status" className="input" defaultValue="WISHLIST"><option value="WISHLIST">Quero</option><option value="IN_PROGRESS">Em andamento</option></select>
            <button className="btn btn-primary">Adicionar</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
