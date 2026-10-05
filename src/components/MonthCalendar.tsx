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

type MarkKind = "birthday" | "holiday" | "nameday" | "custom";

const MARK_ORDER: MarkKind[] = ["birthday", "holiday", "nameday", "custom"];

const MARK_LABEL: Record<MarkKind, string> = {
  birthday: "День рождения",
  holiday: "Праздник",
  nameday: "Именины",
  custom: "Своё событие",
};

const MARK_SHORT: Record<MarkKind, string> = {
  birthday: "ДР",
  holiday: "Праздник",
  nameday: "Именины",
  custom: "Своё",
};

function isNameday(item: UpcomingEvent): boolean {
  return (
    !!item.event.external_id?.startsWith("name-") ||
    item.event.title.startsWith("Именины:")
  );
}

function markKind(item: UpcomingEvent): MarkKind {
  if (item.event.type === "birthday") return "birthday";
  if (isNameday(item)) return "nameday";
  if (item.event.type === "custom") return "custom";
  return "holiday";
}

function kindsForDay(marks: UpcomingEvent[]): MarkKind[] {
  const set = new Set<MarkKind>();
  for (const m of marks) set.add(markKind(m));
  return MARK_ORDER.filter((k) => set.has(k));
}

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
    const out: { day: number | null; marks: UpcomingEvent[]; kinds: MarkKind[] }[] = [];
    for (let i = 0; i < startPad; i++) out.push({ day: null, marks: [], kinds: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const marks = byDay.get(d) ?? [];
      out.push({ day: d, marks, kinds: kindsForDay(marks) });
    }
    while (out.length % 7 !== 0) out.push({ day: null, marks: [], kinds: [] });
    return out;
  }, [items, year, month]);

  const legendKinds = useMemo(() => {
    const set = new Set<MarkKind>();
    for (const c of cells) for (const k of c.kinds) set.add(k);
    return MARK_ORDER.filter((k) => set.has(k));
  }, [cells]);

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
          const primary = c.kinds[0];
          const tip =
            c.marks.length > 0
              ? c.marks.map((m) => m.event.title).slice(0, 4).join(", ") +
                (c.marks.length > 4 ? ` +${c.marks.length - 4}` : "")
              : undefined;
          return (
            <button
              key={c.day}
              type="button"
              className={[
                "month-cell",
                isToday ? "today" : "",
                c.kinds.length ? "has" : "",
                primary ? `has-${primary}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDay(c.day!, c.marks)}
              title={tip}
            >
              <span>{c.day}</span>
              {c.kinds.length > 0 && (
                <span className="month-dots" aria-hidden>
                  {c.kinds.map((k) => (
                    <i key={k} className={`month-dot ${k}`} title={MARK_LABEL[k]} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {legendKinds.length > 0 && (
        <div className="month-legend" aria-label="Обозначения">
          {legendKinds.map((k) => (
            <span key={k} className="month-legend-item">
              <i className={`month-dot ${k}`} />
              {MARK_SHORT[k]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
