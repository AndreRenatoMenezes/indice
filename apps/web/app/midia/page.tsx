import { getMedia } from "@/lib/api";
import { addMedia } from "@/lib/actions";
import { Card, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

const KINDS = [["BOOK", "Livro"], ["GAME", "Jogo"], ["MOVIE", "Filme"], ["SERIES", "Série"], ["COURSE", "Curso"], ["ARTICLE", "Artigo"], ["PODCAST", "Podcast"]] as const;

export default async function Midia() {
  const { items } = await getMedia();
  const groups = ["IN_PROGRESS", "WISHLIST", "PAUSED", "DONE", "DROPPED"] as const;
  return (
    <div className="grid gap-4">
      <Card title="Novo item">
        <form action={addMedia} className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          <select name="kind" className="rounded border bg-transparent px-2 py-1" style={{ borderColor: "var(--line)" }}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          <input name="title" required placeholder="título" className="col-span-2 rounded border bg-transparent px-2 py-1" style={{ borderColor: "var(--line)" }} />
          <input name="creator" placeholder="autor / estúdio" className="rounded border bg-transparent px-2 py-1" style={{ borderColor: "var(--line)" }} />
          <select name="status" className="rounded border bg-transparent px-2 py-1" style={{ borderColor: "var(--line)" }}><option value="WISHLIST">Quero</option><option value="IN_PROGRESS">Em andamento</option></select>
        </form>
      </Card>
      {groups.map((g) => {
        const list = items.filter((i) => i.status === g);
        if (!list.length) return null;
        return (
          <Card key={g} title={g.replace("_", " ").toLowerCase()}>
            <ul className="text-sm">
              {list.map((m) => <li key={m.id} className="flex justify-between py-1"><span>{m.title} <span className="muted text-xs">{m.creator ?? ""}</span></span><span className="muted text-xs">{m.kind.toLowerCase()}{m.rating ? ` · ${m.rating}/10` : ""}</span></li>)}
            </ul>
          </Card>
        );
      })}
      {!items.length && <Empty>Arquivo vazio.</Empty>}
    </div>
  );
}
