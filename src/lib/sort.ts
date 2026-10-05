import type { UpcomingEvent } from "../types";

export type SortMode = "soon" | "alpha" | "tag";

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "soon", label: "Ближе" },
  { value: "alpha", label: "А–Я" },
  { value: "tag", label: "Метка" },
];

export function sortUpcoming(items: UpcomingEvent[], mode: SortMode | string): UpcomingEvent[] {
  const list = [...items];
  if (mode === "alpha") {
    list.sort((a, b) => a.event.title.localeCompare(b.event.title, "ru") || a.daysUntil - b.daysUntil);
    return list;
  }
  if (mode === "tag") {
    list.sort(
      (a, b) =>
        (a.event.tag || "яяя").localeCompare(b.event.tag || "яяя", "ru") ||
        a.daysUntil - b.daysUntil ||
        a.event.title.localeCompare(b.event.title, "ru"),
    );
    return list;
  }
  // soon — already roughly by daysUntil from toUpcoming, keep stable
  list.sort(
    (a, b) => a.daysUntil - b.daysUntil || a.event.title.localeCompare(b.event.title, "ru"),
  );
  return list;
}
