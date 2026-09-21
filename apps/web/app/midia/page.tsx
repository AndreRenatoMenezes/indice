import Link from "next/link";
import { getMedia, dateBR, MEDIA_KIND_LABEL, MEDIA_STATUS_LABEL } from "@/lib/api";
import { addMedia, setMediaProgress, updateMedia } from "@/lib/actions";
import { Btn, Card, Empty, Field, Frame, Progress } from "@/components/ui";
import { MUTED, PALETTE } from "@/components/palette";

export const dynamic = "force-dynamic";

const FILTERS = [["", "Todos"], ["BOOK", "Livros"], ["GAME", "Jogos"], ["COURSE", "Cursos"], ["MOVIE", "Filmes"], ["SERIES", "Séries"]] as const;
const GROUPS = ["IN_PROGRESS", "WISHLIST", "PAUSED", "DONE", "DROPPED"] as const;

export default async function Midia({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = "" } = await searchParams;
  const { items } = await getMedia(kind ? `?kind=${kind}` : "");

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 grid gap-6">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {FILTERS.map(([v, l]) => <Frame key={v} fill={v === kind ? PALETTE.yellow[0] : undefined}><Link href={v ? `/midia?kind=${v}` : "/midia"} className="btn">{l}</Link></Frame>)}
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
                    <li key={m.id} className="pt-3 first:pt-0">
                      <div className="flex items-start gap-3">
                        <Frame radius={4} strokeWidth={1} stroke={MUTED}><span className="mono px-1.5 py-0.5 text-[10px] uppercase">{MEDIA_KIND_LABEL[m.kind]}</span></Frame>
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
                        {m.status !== "IN_PROGRESS" && m.status !== "DONE" && <form action={updateMedia.bind(null, m.id, { status: "IN_PROGRESS" })}><Btn>Começar</Btn></form>}
                        {m.status === "IN_PROGRESS" && <form action={updateMedia.bind(null, m.id, { status: "PAUSED" })}><Btn>Pausar</Btn></form>}
                        {m.status !== "DONE" && <form action={updateMedia.bind(null, m.id, { status: "DONE" })}><Btn>Concluir</Btn></form>}
                        {m.status !== "DROPPED" && m.status !== "DONE" && <form action={updateMedia.bind(null, m.id, { status: "DROPPED" })}><Btn>Abandonar</Btn></form>}
                        <form action={setMediaProgress.bind(null, m.id)} className="ml-auto flex gap-1">
                          {m.status === "IN_PROGRESS" && <Field name="progress" type="number" step="any" min="0" placeholder={m.progressUnit ?? "progresso"} frameClassName="w-24" />}
                          <Field name="rating" type="number" min="1" max="10" placeholder="nota" frameClassName="w-16" />
                          <Btn>Salvar</Btn>
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

      <div className="grid gap-6 content-start">
        <Card title="Novo item">
          <form action={addMedia} className="grid gap-2 text-sm">
            <Frame><select name="kind" className="input w-full" defaultValue={kind || "BOOK"}>{Object.entries(MEDIA_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Frame>
            <Field name="title" required placeholder="título" />
            <Field name="creator" placeholder="autor / estúdio / instituição" />
            <Field name="platform" placeholder="plataforma (Kindle, PS5, físico)" />
            <div className="grid grid-cols-2 gap-2">
              <Field name="progressTotal" type="number" step="any" min="0" placeholder="total (320)" />
              <Field name="progressUnit" placeholder="unidade (páginas, h, %)" />
            </div>
            <Frame><select name="status" className="input w-full" defaultValue="WISHLIST"><option value="WISHLIST">Quero</option><option value="IN_PROGRESS">Em andamento</option></select></Frame>
            <Btn tone="primary">Adicionar</Btn>
          </form>
        </Card>
      </div>
    </div>
  );
}
