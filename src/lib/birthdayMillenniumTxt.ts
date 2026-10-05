import type { EventType } from "../types";
import { pad2 } from "./dates";

export interface ParsedTxtLine {
  day: number;
  month: number;
  year: number | null;
  title: string;
  link: string | null;
  sound_path: string | null;
}

export interface ParseTxtResult {
  items: ParsedTxtLine[];
  errors: string[];
  skipped: number;
}

const DATE_PREFIX =
  /^(\d{1,2})([./\-])(\d{1,2})(?:\2(\d{2}|\d{4}))?(?:\s+|$)(.*)$/;
const COMPACT_DATE = /^(\d{2})(\d{2})(\d{4})?(?:\s+|$)(.*)$/;
const SOUND_EXT = /\.(wav|mp3|midi|mid|ogg)$/i;

export function parseBirthdayMillenniumTxt(text: string): ParseTxtResult {
  const items: ParsedTxtLine[] = [];
  const errors: string[] = [];
  let skipped = 0;

  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      skipped += 1;
      return;
    }
    if (line.startsWith("#") || line.startsWith(";")) {
      skipped += 1;
      return;
    }

    const parsed = parseLine(line);
    if (!parsed) {
      errors.push(`Строка ${index + 1}: не удалось разобрать «${line}»`);
      return;
    }
    items.push(parsed);
  });

  return { items, errors, skipped };
}

function parseLine(line: string): ParsedTxtLine | null {
  let day: number;
  let month: number;
  let year: number | null = null;
  let rest: string;

  const m1 = line.match(DATE_PREFIX);
  if (m1) {
    day = Number(m1[1]);
    month = Number(m1[3]);
    if (m1[4]) {
      const y = Number(m1[4]);
      year = y < 100 ? 1900 + y : y;
    }
    rest = (m1[5] || "").trim();
  } else {
    const m2 = line.match(COMPACT_DATE);
    if (!m2) return null;
    day = Number(m2[1]);
    month = Number(m2[2]);
    if (m2[3]) year = Number(m2[3]);
    rest = (m2[4] || "").trim();
  }

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  let link: string | null = null;
  let sound_path: string | null = null;
  let title = rest;

  const urlMatch = rest.match(/(https?:\/\/\S+|mailto:\S+)/i);
  if (urlMatch) {
    link = urlMatch[1];
    title = rest.replace(urlMatch[0], "").trim();
  }

  const parts = title.split(/\s+/);
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (SOUND_EXT.test(last) || last.includes("\\") || last.includes("/")) {
      if (SOUND_EXT.test(last) || /\.(wav|mp3)$/i.test(last)) {
        sound_path = last;
        title = parts.slice(0, -1).join(" ").trim();
      }
    }
  }

  if (!title) title = "Без названия";
  return { day, month, year, title, link, sound_path };
}

export function exportBirthdayMillenniumTxt(
  events: Array<{
    day: number;
    month: number;
    year: number | null;
    title: string;
    link?: string | null;
    sound_path?: string | null;
  }>,
): string {
  const header = "# DATES export — совместимо с Birthday Millennium\n";
  const body = events
    .map((e) => {
      const date =
        e.year != null
          ? `${pad2(e.day)}.${pad2(e.month)}.${e.year}`
          : `${pad2(e.day)}.${pad2(e.month)}`;
      const bits = [date, e.title];
      if (e.link) bits.push(e.link);
      if (e.sound_path) bits.push(e.sound_path);
      return bits.join(" ");
    })
    .join("\n");
  return header + body + (body ? "\n" : "");
}

/** Mass paste formats: "Name DD.MM.YYYY" or "Name, YYYY-MM-DD" */
export function parseBulkPeople(text: string, defaultType: EventType = "birthday") {
  const items: Array<{
    title: string;
    day: number;
    month: number;
    year: number | null;
    type: EventType;
  }> = [];
  const errors: string[] = [];

  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;

    // Name, YYYY-MM-DD
    const iso = line.match(/^(.+?)[,\s]+(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      items.push({
        title: iso[1].trim(),
        year: Number(iso[2]),
        month: Number(iso[3]),
        day: Number(iso[4]),
        type: defaultType,
      });
      return;
    }

    // Name DD.MM.YYYY or Name DD.MM
    const ru = line.match(/^(.+?)\s+(\d{1,2})[./\-](\d{1,2})(?:[./\-](\d{2,4}))?$/);
    if (ru) {
      let year: number | null = null;
      if (ru[4]) {
        const y = Number(ru[4]);
        year = y < 100 ? 1900 + y : y;
      }
      items.push({
        title: ru[1].trim(),
        day: Number(ru[2]),
        month: Number(ru[3]),
        year,
        type: defaultType,
      });
      return;
    }

    // Fallback: BM style date-first
    const bm = parseLine(line);
    if (bm) {
      items.push({
        title: bm.title,
        day: bm.day,
        month: bm.month,
        year: bm.year,
        type: defaultType,
      });
      return;
    }

    errors.push(`Строка ${i + 1}: «${line}»`);
  });

  return { items, errors };
}
