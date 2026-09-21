import Link from "next/link";
import { getMedia, dateBR, MEDIA_KIND_LABEL, MEDIA_STATUS_LABEL } from "@/lib/api";
import { addMedia, setMediaProgress, updateMedia } from "@/lib/actions";
import { Btn, Card, Empty, Field, Frame, Pill, Progress, Stat } from "@/components/ui";
import { PageHead, Quote, SectionLabel } from "@/components/paper";
import { PALETTE, type Tone } from "@/components/palette";

export const dynamic = "force-dynamic";

const FILTERS = [["", "Todos"], ["BOOK", "Livros"], ["GAME", "Jogos"], ["COURSE", "Cursos"], ["MOVIE", "Filmes"], ["SERIES", "Séries"]] as const;
const GROUPS = ["IN_PROGRESS", "WISHLIST", "PAUSED", "DONE", "DROPPED"] as const;
const STATUS_TONE: Record<(typeof GROUPS)[number], Tone> = {
  IN_PROGRESS: "yellow", WISHLIST: "gray", PAUSED: "violet", DONE: "green", DROPPED: "red",
};

export default async function Midia({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind = "" } = await searchParams;
  const { items } = await getMedia(kind ? `?kind=${kind}` : "");
  const title = FILTERS.find(([v]) => v === kind)?.[1] ?? "Todos";
  const finished = items.filter((i) => i.status === "DONE").length;
  const running = items.filter((i) => i.status === "IN_PROGRESS").length;

  return (
    <>
      <PageHead
        eyebrow="Índice · coleção"
        title={kind ? title : "Arquivo"}
        meta={`${finished} de ${items.length}`}
        sub={`${items.length} ${items.length === 1 ? "item" : "itens"} · ${new Date().getFullYear()}`}
      />

      <div className="mt-8 grid items-start gap-11 md:grid-cols-[minmax(0,1.7fr)_minmax(0,250px)]">
        <main className="flex min-w-0 flex-col gap-7">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {FILTERS.map(([v, l]) => (
              <Frame key={v} fill={v === kind ? PALETTE.yellow[0] : undefined}>
                <Link href={v ? `/midia?kind=${v}` : "/midia"} className="btn">{l}</Link>
              </Frame>
            ))}
          </div>

          {GROUPS.map((g) => {
            const list = items.filter((i) => i.status === g);
            if (!list.length) return null;
            return (
              <section key={g}>
                <SectionLabel className="mb-3">{MEDIA_STATUS_LABEL[g]}</SectionLabel>
                <ul className="flex flex-col">
                  {list.map((m, i) => {
                    const pct = m.progress != null && m.progressTotal ? (m.progress / m.progressTotal) * 100 : null;
                    return (
                      <li key={m.id} className="border-b border-[var(--rule-soft)] py-3.5">
                        <div className="flex items-baseline gap-4">
                          <span className="mono w-[22px] flex-none font-display text-[13px] text-[var(--ink-faint)]">{String(i + 1).padStart(2, "0")}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[18px]">{m.title}</span>
                            <span className="mt-0.5 block font-display text-sm italic text-[var(--ink-soft)]">
                              {[MEDIA_KIND_LABEL[m.kind], m.creator, m.platform, m.year].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <Pill tone={STATUS_TONE[g]}>{MEDIA_STATUS_LABEL[g]}</Pill>
                        </div>
                        <div className="mt-1.5 ml-[38px] text-xs muted">
                          {pct != null ? `${m.progress} de ${m.progressTotal} ${m.progressUnit ?? ""} · ${pct.toFixed(0)}%` : m.status === "DONE" ? `terminado em ${dateBR(m.finishedAt)}` : m.startedAt ? `desde ${dateBR(m.startedAt)}` : ""}
                          {m.rating ? ` · ${m.rating}/10` : ""}
                        </div>
                        {pct != null && <div className="mt-1.5 ml-[38px]"><Progress pct={pct} /></div>}
                        <div className="mt-2.5 ml-[38px] flex flex-wrap items-center gap-2 text-xs">
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
              </section>
            );
          })}
          {!items.length && <Empty>Arquivo vazio.</Empty>}

          <div>
            <SectionLabel className="mb-3">Somar à coleção</SectionLabel>
            <form action={addMedia} className="grid max-w-[460px] gap-2 text-sm">
              <Frame><select name="kind" className="input w-full" defaultValue={kind || "BOOK"}>{Object.entries(MEDIA_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Frame>
              <Field name="title" required placeholder="título, autor…" />
              <Field name="creator" placeholder="autor / estúdio / instituição" />
              <Field name="platform" placeholder="plataforma (Kindle, PS5, físico)" />
              <div className="grid grid-cols-2 gap-2">
                <Field name="progressTotal" type="number" step="any" min="0" placeholder="total (320)" />
                <Field name="progressUnit" placeholder="unidade (páginas, h, %)" />
              </div>
              <Frame><select name="status" className="input w-full" defaultValue="WISHLIST"><option value="WISHLIST">Quero</option><option value="IN_PROGRESS">Em andamento</option></select></Frame>
              <Btn tone="primary">somar</Btn>
            </form>
          </div>
        </main>

        <aside className="flex min-w-0 flex-col gap-5">
          <div className="grid grid-cols-2 gap-3.5">
            <Stat label="Concluídos" value={String(finished)} tone="green" />
            <Stat label="Em andamento" value={String(running)} />
          </div>

          {items.length > 0 && (
            <Card title="Progresso">
              <div className="flex items-baseline justify-between">
                <span className="text-[17px] muted">{items.length} {items.length === 1 ? "item" : "itens"}</span>
                <span className="mono text-[17px]">{((finished / items.length) * 100).toFixed(0)}%</span>
              </div>
              <Progress pct={(finished / items.length) * 100} />
              <div className="label tracking-[0.18em] text-[var(--ink-faint)]">faltam {items.length - finished} para fechar</div>
            </Card>
          )}

          <Quote>Uma coleção é só uma lista que você resolveu levar a sério.</Quote>
        </aside>
      </div>
    </>
  );
}
