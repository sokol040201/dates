import type { AppEvent, EventType, ImportReport } from "../types";
import {
  exportBirthdayMillenniumTxt,
  parseBirthdayMillenniumTxt,
} from "./birthdayMillenniumTxt";
import { createEvent, type NewEventInput } from "./db";
import { formatShortDate } from "./dates";

export async function importTxtContent(
  text: string,
  defaultType: EventType,
  encoding?: string,
): Promise<ImportReport> {
  const parsed = parseBirthdayMillenniumTxt(text);
  let imported = 0;
  for (const item of parsed.items) {
    const input: NewEventInput = {
      title: item.title,
      type: defaultType,
      month: item.month,
      day: item.day,
      year: item.year,
      link: item.link,
      sound_path: item.sound_path,
      source: "user",
    };
    await createEvent(input);
    imported += 1;
  }
  return {
    imported,
    skipped: parsed.skipped,
    errors: parsed.errors,
    encoding,
  };
}

export function eventsToTxt(events: AppEvent[]): string {
  return exportBirthdayMillenniumTxt(
    events
      .filter((e) => e.source === "user" && !e.hidden)
      .map((e) => ({
        day: e.day,
        month: e.month,
        year: e.year,
        title: e.title,
        link: e.link,
        sound_path: e.sound_path,
      })),
  );
}

export function eventsToCsv(events: AppEvent[]): string {
  const header = "title,type,date,year,notes,link,tag,remind_days\n";
  const rows = events
    .filter((e) => e.source === "user")
    .map((e) => {
      const date = formatShortDate(e.month, e.day, e.year);
      const cells = [
        e.title,
        e.type,
        date,
        e.year ?? "",
        e.notes ?? "",
        e.link ?? "",
        e.tag ?? "",
        e.remind_days ?? "",
      ].map(csvEscape);
      return cells.join(",");
    });
  return header + rows.join("\n") + "\n";
}

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function importCsvContent(text: string): Promise<ImportReport> {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    return { imported: 0, skipped: 0, errors: ["Пустой CSV"] };
  }
  const start = /title/i.test(lines[0]) ? 1 : 0;
  let imported = 0;
  const errors: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const cols = splitCsv(lines[i]);
    if (cols.length < 3) {
      errors.push(`Строка ${i + 1}: мало колонок`);
      continue;
    }
    const title = cols[0];
    const type = (cols[1] as EventType) || "birthday";
    const dateRaw = cols[2];
    const m = dateRaw.match(/(\d{1,2})[./\-](\d{1,2})(?:[./\-](\d{2,4}))?/);
    if (!m) {
      errors.push(`Строка ${i + 1}: плохая дата`);
      continue;
    }
    let year: number | null = cols[3] ? Number(cols[3]) : null;
    if (!year && m[3]) {
      const y = Number(m[3]);
      year = y < 100 ? 1900 + y : y;
    }
    await createEvent({
      title,
      type: ["birthday", "holiday", "custom"].includes(type) ? type : "birthday",
      day: Number(m[1]),
      month: Number(m[2]),
      year,
      notes: cols[4] || null,
      link: cols[5] || null,
      source: "user",
    });
    imported += 1;
  }
  return { imported, skipped: 0, errors };
}

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function eventsToJson(events: AppEvent[]): string {
  const payload = events
    .filter((e) => e.source === "user")
    .map((e) => ({
      title: e.title,
      type: e.type,
      day: e.day,
      month: e.month,
      year: e.year,
      notes: e.notes,
      link: e.link,
      remind_days: e.remind_days,
      tag: e.tag,
      sound_path: e.sound_path,
    }));
  return JSON.stringify(payload, null, 2);
}

export async function importJsonContent(text: string): Promise<ImportReport> {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { imported: 0, skipped: 0, errors: ["Невалидный JSON"] };
  }
  if (!Array.isArray(data)) {
    return { imported: 0, skipped: 0, errors: ["Ожидался массив"] };
  }
  let imported = 0;
  const errors: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i] as Record<string, unknown>;
    if (!row.title || !row.month || !row.day) {
      errors.push(`Элемент ${i + 1}: нет title/month/day`);
      continue;
    }
    await createEvent({
      title: String(row.title),
      type: (row.type as EventType) || "birthday",
      month: Number(row.month),
      day: Number(row.day),
      year: row.year != null ? Number(row.year) : null,
      notes: row.notes != null ? String(row.notes) : null,
      link: row.link != null ? String(row.link) : null,
      remind_days: row.remind_days != null ? Number(row.remind_days) : null,
      tag: row.tag != null ? String(row.tag) : null,
      sound_path: row.sound_path != null ? String(row.sound_path) : null,
      source: "user",
    });
    imported += 1;
  }
  return { imported, skipped: 0, errors };
}
