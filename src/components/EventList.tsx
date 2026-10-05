import type { ReactNode } from "react";
import type { UpcomingEvent } from "../types";
import { tagLabel } from "../types";
import { anniversaryLabel, formatShortDate, relativeLabel } from "../lib/dates";
import { photoSrc } from "../lib/media";

interface Props {
  items: UpcomingEvent[];
  empty: ReactNode;
  personal?: boolean;
  onSelect?: (item: UpcomingEvent) => void;
}

function shortWhen(daysUntil: number): string {
  if (daysUntil === -1) return "Вчера";
  if (daysUntil === 0) return "Сегодня";
  if (daysUntil === 1) return "Завтра";
  return `Через ${daysUntil} дн.`;
}

function ageBitLabel(age: number): string {
  const mod10 = age % 10;
  const mod100 = age % 100;
  let word = "лет";
  if (mod10 === 1 && mod100 !== 11) word = "год";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = "года";
  return `${age} ${word}`;
}

export function EventList({ items, empty, personal, onSelect }: Props) {
  if (!items.length) {
    return <>{empty}</>;
  }

  return (
    <>
      {items.map((item, i) => {
        const when = shortWhen(item.daysUntil);
        const tone =
          item.daysUntil === 0 ? "today" : item.daysUntil < 0 ? "past" : "soon";
        const dateBit = formatShortDate(item.event.month, item.event.day);
        const ageLabel = personal ? anniversaryLabel(item.age) : "";
        const ageBit =
          personal && item.event.type === "birthday" && item.age != null && item.age > 0
            ? ageBitLabel(item.age)
            : ageLabel;
        const title = personal
          ? item.daysUntil === 0
            ? `поздравим ${item.event.title}`
            : item.event.title
          : item.event.title;
        const src = photoSrc(item.event.photo_path);
        const tag = tagLabel(item.event.tag);
        const metaParts = [dateBit, ageBit, tag].filter(Boolean);

        return (
          <button
            type="button"
            className="row"
            key={`${item.event.id}-${item.daysUntil}`}
            style={{ animationDelay: `${i * 0.03}s` }}
            onClick={() => onSelect?.(item)}
            title={relativeLabel(item.daysUntil)}
          >
            {src ? <img className="avatar" src={src} alt="" /> : null}
            <div className={`row-when ${tone}`}>{when}</div>
            <div className="row-main">
              <div className="row-title">
                <span className="row-title-text">{title}</span>
                {metaParts.length > 0 && (
                  <span className="row-inline-meta"> · {metaParts.join(" · ")}</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </>
  );
}
