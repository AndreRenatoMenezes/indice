import { Card, WeekDots } from "@indice/web";

const week = (statuses: string[]) =>
  statuses.map((status, i) => ({ date: `2026-09-${14 + i}`, status })) as never;

export function SemanaEmAndamento() {
  return <WeekDots week={week(["done", "done", "miss", "done", "today", "future", "future"])} />;
}

export function Estados() {
  return (
    <div className="flex flex-col gap-4">
      <div><div className="text-xs muted">semana cheia</div><WeekDots week={week(["done", "done", "done", "done", "done", "done", "done"])} /></div>
      <div><div className="text-xs muted">com folga no fim de semana</div><WeekDots week={week(["done", "done", "done", "miss", "done", "off", "off"])} /></div>
      <div><div className="text-xs muted">semana perdida</div><WeekDots week={week(["miss", "miss", "miss", "miss", "today", "future", "future"])} /></div>
    </div>
  );
}

export function DentroDeCard() {
  return (
    <div style={{ width: 460 }}>
      <Card title="Hábitos">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Correr 5 km</div>
            <div className="text-xs muted">seg, qua, sex · booleano</div>
          </div>
          <WeekDots week={week(["done", "off", "done", "off", "today", "off", "off"])} />
        </div>
      </Card>
    </div>
  );
}
