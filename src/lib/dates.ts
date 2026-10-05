import type { AppEvent, UpcomingEvent } from "../types";

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDateRu(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

export function formatWeekdayShort(date: Date): string {
  return date.toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "");
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function formatShortDate(month: number, day: number, year?: number | null): string {
  if (year) return `${pad2(day)}.${pad2(month)}.${year}`;
  return `${pad2(day)}.${pad2(month)}`;
}

export function nextOccurrence(month: number, day: number, from = new Date()): Date {
  const year = from.getFullYear();
  let candidate = safeDate(year, month, day);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  if (candidate < start) {
    candidate = safeDate(year + 1, month, day);
  }
  return candidate;
}

function safeDate(year: number, month: number, day: number): Date {
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    return new Date(year, 1, 28);
  }
  return new Date(year, month - 1, day);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const b0 = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((b0 - a0) / ms);
}

export function computeAge(birthYear: number, nextDate: Date): number {
  return nextDate.getFullYear() - birthYear;
}

export function toUpcoming(
  events: AppEvent[],
  horizonDays: number,
  from = new Date(),
  includeYesterday = true,
): UpcomingEvent[] {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const mapped = events
    .filter((e) => !e.hidden)
    .flatMap((event) => {
      const items: UpcomingEvent[] = [];

      if (includeYesterday) {
        const yday = new Date(today);
        yday.setDate(yday.getDate() - 1);
        if (event.month === yday.getMonth() + 1 && event.day === yday.getDate()) {
          const age =
            event.type === "birthday" && event.year != null
              ? computeAge(event.year, yday)
              : null;
          items.push({ event, daysUntil: -1, nextDate: yday, age });
        }
      }

      let nextDate: Date;
      if (event.source !== "user" && event.year != null) {
        const concrete = safeDate(event.year, event.month, event.day);
        nextDate = concrete >= today ? concrete : nextOccurrence(event.month, event.day, today);
      } else {
        nextDate = nextOccurrence(event.month, event.day, today);
      }
      const daysUntil = daysBetween(today, nextDate);
      if (daysUntil <= horizonDays) {
        const age =
          event.type === "birthday" && event.year != null
            ? computeAge(event.year, nextDate)
            : null;
        items.push({ event, daysUntil, nextDate, age });
      }
      return items;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil || a.event.title.localeCompare(b.event.title, "ru"));

  const seen = new Set<string>();
  return mapped.filter((u) => {
    const key = `${u.event.source}:${u.event.title}:${u.daysUntil}:${u.event.month}-${u.event.day}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function relativeLabel(daysUntil: number): string {
  if (daysUntil === -1) return "Вчера";
  if (daysUntil === 0) return "Сегодня";
  if (daysUntil === 1) return "Завтра";
  const mod10 = daysUntil % 10;
  const mod100 = daysUntil % 100;
  let word = "дней";
  if (mod10 === 1 && mod100 !== 11) word = "день";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = "дня";
  return `Через ${daysUntil} ${word}`;
}

export function anniversaryLabel(age: number | null): string {
  if (age == null || age <= 0) return "";
  const mod10 = age % 10;
  const mod100 = age % 100;
  let word = "я";
  if (mod10 === 1 && mod100 !== 11) word = "я";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = "я";
  return `${age}-${word} годовщина`;
}
