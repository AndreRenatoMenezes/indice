import Link from "next/link";
import type { EntryDto } from "@indice/shared";
import { getEntriesRange, getGoals, getHabitsToday, getLists, getRecurrenceRules, dateBR } from "@/lib/api";
import { addDays, dayOfMonth, isoWeek, monthName, weekOf } from "@/lib/dates";
import { Card, Empty, Pill, Progress, SketchLine, Stat, WeekDots } from "@/components/ui";
import { PageHead, SectionLabel } from "@/components/paper";
import { WeekBoard } from "@/components/week/WeekBoard";

export const dynamic = "force-dynamic";

// Sem `?date=`, a API resolve "hoje" no fuso dela; pegamos o dia de volta
// pelo /habits/today para que a semana não dependa do relógio do servidor web.
// Com `?date=`, "hoje" vem de uma segunda chamada sem data.
async function load(date?: string) {
  const viewed = await getHabitsToday(date);
  const days = weekOf(viewed.date);
  const [today, { entries }, { lists }, { rules }, { goals }] = await Promise.all([
    date ? getHabitsToday().then((t) => t.date) : Promise.resolve(viewed.date),
    getEntriesRange(days[0]!, days[6]!),
    getLists(),
    getRecurrenceRules(),
    getGoals(),
  ]);
  return { viewed, today, entries, lists, rules, goals };
}

export default async function Semana({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  let data;
  try {
    data = await load(date);
  } catch (e) {
    return <Card title="API indisponível"><Empty>{String((e as Error).message)}</Empty></Card>;
  }
  const { viewed, today, entries, lists, rules, goals } = data;

  const days = weekOf(viewed.date);
  const [from, to] = [days[0]!, days[6]!];
  const byDay: Record<string, EntryDto[]> = Object.fromEntries(days.map((d) => [d, []]));
  for (const e of entries) if (e.date && byDay[e.date]) byDay[e.date]!.push(e);

  const done = entries.filter((e) => e.status === "DONE").length;
  const streak = viewed.habits.reduce((max, h) => Math.max(max, h.streak), 0);
  const tags = [...new Set(entries.flatMap((e) => e.tags))];
  // Candidatas a migrar: aberto em dia da semana que já passou.
  const pending = entries.filter((e) => e.status === "OPEN" && e.date && e.date < today);

  return (
    <>
      <PageHead
        eyebrow="Índice · semanal"
        title={`Semana ${isoWeek(viewed.date)}`}
        meta={`${dayOfMonth(from)} — ${dayOfMonth(to)} de ${monthName(to)}`}
        sub={`${done} de ${entries.length} concluídas`}
      >
        <nav aria-label="Semana" className="flex gap-2 pb-1 text-[19px]">
          <Link href={`/semana?date=${addDays(viewed.date, -7)}`} title="semana anterior">‹</Link>
          <Link href={`/semana?date=${addDays(viewed.date, 7)}`} title="próxima semana">›</Link>
        </nav>
      </PageHead>

      <WeekBoard
        today={today}
        days={days}
        initial={{ days: byDay, lists, rules }}
        goals={goals.map((g) => ({ id: g.id, title: g.title }))}
        habits={
          <div className="flex flex-col gap-7">
            <SketchLine stroke="var(--ink-soft)" />
            <section>
              <SectionLabel className="mb-4">Hábitos</SectionLabel>
              <div className="grid gap-x-10 gap-y-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
                {viewed.habits.map((h) => (
                  <div key={h.habit.id} className="flex items-center justify-between gap-5">
                    <span className="text-base">{h.habit.name}</span>
                    <WeekDots week={h.week} />
                  </div>
                ))}
                {!viewed.habits.length && <Empty>Nenhum hábito. Crie em Hábitos.</Empty>}
              </div>
            </section>
          </div>
        }
        asideTop={
          <div className="flex flex-col gap-5">
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
          </div>
        }
        asideBottom={
          <div>
            <SectionLabel className="mb-3">Migrar para {isoWeek(addDays(viewed.date, 7))}</SectionLabel>
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
        }
      />
    </>
  );
}
