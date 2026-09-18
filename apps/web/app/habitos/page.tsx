import { getHabitsToday } from "@/lib/api";
import { logHabit } from "@/lib/actions";
import { Card, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Habitos() {
  const { date, habits } = await getHabitsToday();
  return (
    <Card title={`Hábitos · ${date}`}>
      <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
        {habits.map((h) => (
          <li key={h.habit.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <div>{h.habit.name}</div>
              <div className="text-xs muted">{h.habit.kind.toLowerCase()}{h.habit.targetTime ? ` · até ${h.habit.targetTime}` : ""}{h.habit.targetValue ? ` · meta ${h.habit.targetValue} ${h.habit.unit ?? ""}` : ""} · sequência {h.streak}d</div>
            </div>
            <form action={logHabit.bind(null, h.habit.id, !h.done, date)}>
              <button className="rounded border px-3 py-1" style={{ borderColor: "var(--line)", background: h.done ? "var(--green)" : "transparent", color: h.done ? "white" : "inherit" }}>{h.done ? "Feito" : "Marcar"}</button>
            </form>
          </li>
        ))}
      </ul>
      {!habits.length && <Empty>Nenhum hábito cadastrado.</Empty>}
    </Card>
  );
}
