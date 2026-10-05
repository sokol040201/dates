import { useMemo } from "react";
import type { UpcomingEvent } from "../types";
import { IconChevronLeft, IconChevronRight } from "./Icons";

interface Props {
  items: UpcomingEvent[];
  year: number;
  month: number; // 1-12
  onSelectDay: (day: number, items: UpcomingEvent[]) => void;
  onPrev: () => void;
  onNext: () => void;
}

const WEEK = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function MonthCalendar({ items, year, month, onSelectDay, onPrev, onNext }: Props) {
  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const startPad = (first.getDay() + 6) % 7; // Monday=0
    const daysInMonth = new Date(year, month, 0).getDate();
    const byDay = new Map<number, UpcomingEvent[]>();
    for (const item of items) {
      if (item.event.month !== month) continue;
      const list = byDay.get(item.event.day) ?? [];
      list.push(item);
      byDay.set(item.event.day, list);
    }
    const out: { day: number | null; marks: UpcomingEvent[] }[] = [];
    for (let i = 0; i < startPad; i++) out.push({ day: null, marks: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ day: d, marks: byDay.get(d) ?? [] });
    }
    while (out.length % 7 !== 0) out.push({ day: null, marks: [] });
    return out;
  }, [items, year, month]);

  const today = new Date();
  const isThisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const title = new Date(year, month - 1, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="month-cal">
      <div className="month-cal-head">
        <button type="button" className="icon-btn" onClick={onPrev} title="Назад" aria-label="Назад">
          <IconChevronLeft size={16} />
        </button>
        <span className="month-cal-title">{title}</span>
        <button type="button" className="icon-btn" onClick={onNext} title="Вперёд" aria-label="Вперёд">
          <IconChevronRight size={16} />
        </button>
      </div>
      <div className="month-cal-week">
        {WEEK.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="month-cal-grid">
        {cells.map((c, i) => {
          if (c.day == null) return <div key={`e-${i}`} className="month-cell empty" />;
          const isToday = isThisMonth && c.day === today.getDate();
          return (
            <button
              key={c.day}
              type="button"
              className={`month-cell ${isToday ? "today" : ""} ${c.marks.length ? "has" : ""}`}
              onClick={() => onSelectDay(c.day!, c.marks)}
            >
              <span>{c.day}</span>
              {c.marks.length > 0 && <i className="month-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
