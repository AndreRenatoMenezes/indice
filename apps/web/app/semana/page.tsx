import Link from "next/link";
import type { EntryDto } from "@indice/shared";
import { getEntriesRange, getGoals, getHabitsToday, dateBR } from "@/lib/api";
import { addDays, dayOfMonth, isoWeek, monthName, weekOf, weekdayShort } from "@/lib/dates";
import { Card, Empty, Pill, Progress, SketchLine, Stat, WeekDots } from "@/components/ui";
import { Bullet, PageHead, SectionLabel } from "@/components/paper";
import { Sketch } from "@/components/sketch";

export const dynamic = "force-dynamic";

export default async function Semana({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  // Sem `?date=`, a API resolve "hoje" no fuso dela; pegamos o dia de volta
  // pelo /habits/today para que a semana não dependa do relógio do servidor web.
  const today = await getHabitsToday(date);
  const days = weekOf(today.date);
  const [from, to] = [days[0]!, days[6]!];

  let entries: EntryDto[];
  let goals;
  try {
    [{ entries }, { goals }] = await Promise.all([getEntriesRange(from, to), getGoals()]);
  } catch (e) {
    return <Card title="API indisponível"><Empty>{String((e as Error).message)}</Empty></Card>;
  }

  const byDay = new Map<string, EntryDto[]>();
  for (const e of entries) if (e.date) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  const done = entries.filter((e) => e.status === "DONE").length;
  const streak = today.habits.reduce((max, h) => Math.max(max, h.streak), 0);
  const tags = [...new Set(entries.flatMap((e) => e.tags))];
  // Candidatas a migrar: aberto em dia da semana que já passou.
  const pending = entries.filter((e) => e.status === "OPEN" && e.date && e.date < today.date);

  return (
    <>
      <PageHead
        eyebrow="Índice · semanal"
        title={`Semana ${isoWeek(today.date)}`}
        meta={`${dayOfMonth(from)} — ${dayOfMonth(to)} de ${monthName(to)}`}
        sub={`${done} de ${entries.length} concluídas`}
      >
        <nav aria-label="Semana" className="flex gap-2 pb-1 text-[19px]">
          <Link href={`/semana?date=${addDays(today.date, -7)}`} title="semana anterior">‹</Link>
          <Link href={`/semana?date=${addDays(today.date, 7)}`} title="próxima semana">›</Link>
        </nav>
      </PageHead>

      <div className="mt-8 grid items-start gap-11 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
        <main className="flex min-w-0 flex-col gap-7">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {days.map((d) => {
              const isToday = d === today.date;
              const list = byDay.get(d) ?? [];
              // Todas as colunas com o mesmo respiro; só o dia de hoje ganha a moldura.
              return (
                <section key={d} className="relative min-w-0 px-4 py-4">
                  {isToday && <Sketch radius={12} fill="var(--paper-raised)" stroke="var(--line)" />}
                  <div className="relative">
                    <div className="mb-3 flex items-baseline justify-between border-b border-[var(--rule-soft)] pb-1.5">
                      <span className="label">{weekdayShort(d)}{isToday ? " · hoje" : ""}</span>
                      <span className="mono font-display text-[13px] text-[var(--ink-faint)]">{dayOfMonth(d)}</span>
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {list.map((e) => <li key={e.id}><Bullet entry={e} size="sm" /></li>)}
                    </ul>
                  </div>
                </section>
              );
            })}
          </div>

          <SketchLine stroke="var(--ink-soft)" />

          <section>
            <SectionLabel className="mb-4">Hábitos</SectionLabel>
            <div className="grid gap-x-10 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
              {today.habits.map((h) => (
                <div key={h.habit.id} className="flex items-center justify-between gap-5">
                  <span className="text-base">{h.habit.name}</span>
                  <WeekDots week={h.week} />
                </div>
              ))}
              {!today.habits.length && <Empty>Nenhum hábito. Crie em Hábitos.</Empty>}
            </div>
          </section>
        </main>

        <aside className="flex min-w-0 flex-col gap-5">
          <Stat label="Sequência" value={`${streak} ${streak === 1 ? "dia" : "dias"}`} />

          {goals.length > 0 && (
            <Card title="Metas da semana">
              {goals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="text-base muted">{g.title}</span>
                    <span className="mono text-[15px]">{g.progressPct.toFixed(0)}%</span>
                  </div>
                  <Progress pct={g.progressPct} color={g.color} />
                </div>
              ))}
            </Card>
          )}

          {tags.length > 0 && (
            <Card title="Coleções">
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => <Pill key={t} tone="gray">{t}</Pill>)}
              </div>
            </Card>
          )}

          <div>
            <SectionLabel className="mb-3">Migrar para {isoWeek(addDays(today.date, 7))}</SectionLabel>
            {pending.length ? (
              <ul className="flex flex-col gap-2.5">
                {pending.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-3">
                    <span className="label tracking-[0.16em] text-[var(--ink-faint)]">{dateBR(e.date).slice(0, 5)}</span>
                    <span className="flex-1 text-base">{e.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty>Nada pendente por aqui.</Empty>
            )}
          </div>

        </aside>
      </div>
    </>
  );
}
