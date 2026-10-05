import Database from "@tauri-apps/plugin-sql";
import type { AppEvent, AppSettings, EventSource, EventType } from "../types";

let dbPromise: Promise<Database> | null = null;

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** In-memory fallback for `npm run dev` without Tauri */
const memory = {
  events: [] as AppEvent[],
  settings: defaultSettings(),
};

function defaultSettings(): AppSettings {
  return {
    country_code: "WORLD",
    remind_days: 14,
    autostart: 0,
    theme: "light",
    sound_enabled: 1,
    start_minimized: 0,
    holidays_synced_at: null,
    show_yesterday: 1,
    show_ticker: 1,
    show_holidays: 1,
    show_personal: 1,
    always_on_top: 0,
    font_size: 14,
    global_hotkey: 1,
    accent: "sage",
    sort_mode: "soon",
    repeat_on_day: 1,
    window_size: "normal",
    glass_opacity: 88,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return crypto.randomUUID();
}

async function getDb(): Promise<Database | null> {
  if (!isTauri()) return null;
  if (!dbPromise) {
    dbPromise = Database.load("sqlite:dates.db").then(async (db) => {
      await migrate(db);
      return db;
    });
  }
  return dbPromise;
}

async function migrate(db: Database) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      month INTEGER NOT NULL,
      day INTEGER NOT NULL,
      year INTEGER,
      notes TEXT,
      link TEXT,
      remind_days INTEGER,
      sound_path TEXT,
      photo_path TEXT,
      tag TEXT,
      source TEXT NOT NULL DEFAULT 'user',
      external_id TEXT,
      hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_events_external
    ON events(external_id) WHERE external_id IS NOT NULL;
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      country_code TEXT NOT NULL,
      remind_days INTEGER NOT NULL,
      autostart INTEGER NOT NULL,
      theme TEXT NOT NULL,
      sound_enabled INTEGER NOT NULL,
      start_minimized INTEGER NOT NULL,
      holidays_synced_at TEXT,
      show_yesterday INTEGER NOT NULL DEFAULT 1
    );
  `);
  const alters = [
    `ALTER TABLE settings ADD COLUMN show_yesterday INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN show_ticker INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN show_holidays INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN show_personal INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN always_on_top INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE settings ADD COLUMN font_size INTEGER NOT NULL DEFAULT 14`,
    `ALTER TABLE settings ADD COLUMN global_hotkey INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN accent TEXT NOT NULL DEFAULT 'sage'`,
    `ALTER TABLE settings ADD COLUMN sort_mode TEXT NOT NULL DEFAULT 'soon'`,
    `ALTER TABLE settings ADD COLUMN repeat_on_day INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE settings ADD COLUMN window_size TEXT NOT NULL DEFAULT 'normal'`,
    `ALTER TABLE settings ADD COLUMN glass_opacity INTEGER NOT NULL DEFAULT 88`,
    `ALTER TABLE events ADD COLUMN photo_path TEXT`,
    `ALTER TABLE events ADD COLUMN tag TEXT`,
  ];
  for (const sql of alters) {
    try {
      await db.execute(sql);
    } catch {
      /* column exists */
    }
  }
  await db.execute(`UPDATE settings SET theme = 'light' WHERE theme = 'dark'`);

  const rows = await db.select<AppSettings[]>("SELECT * FROM settings WHERE id = 1");
  if (rows.length === 0) {
    const s = defaultSettings();
    await db.execute(
      `INSERT INTO settings (id, country_code, remind_days, autostart, theme, sound_enabled, start_minimized, holidays_synced_at, show_yesterday, show_ticker, show_holidays, show_personal, always_on_top, font_size, global_hotkey, accent, sort_mode, repeat_on_day, window_size, glass_opacity)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        s.country_code,
        s.remind_days,
        s.autostart,
        s.theme,
        s.sound_enabled,
        s.start_minimized,
        s.holidays_synced_at,
        s.show_yesterday,
        s.show_ticker,
        s.show_holidays,
        s.show_personal,
        s.always_on_top,
        s.font_size,
        s.global_hotkey,
        s.accent,
        s.sort_mode,
        s.repeat_on_day,
        s.window_size,
        s.glass_opacity,
      ],
    );
  }
}

export interface NewEventInput {
  title: string;
  type: EventType;
  month: number;
  day: number;
  year?: number | null;
  notes?: string | null;
  link?: string | null;
  remind_days?: number | null;
  sound_path?: string | null;
  photo_path?: string | null;
  tag?: string | null;
  source?: EventSource;
  external_id?: string | null;
  hidden?: number;
}

function normalizeEvent(row: AppEvent): AppEvent {
  return {
    ...row,
    photo_path: row.photo_path ?? null,
    tag: row.tag ?? null,
  };
}

export async function listEvents(): Promise<AppEvent[]> {
  const db = await getDb();
  if (!db) {
    return [...memory.events]
      .map(normalizeEvent)
      .sort((a, b) => a.month - b.month || a.day - b.day || a.title.localeCompare(b.title));
  }
  const rows = await db.select<AppEvent[]>(
    "SELECT * FROM events ORDER BY month ASC, day ASC, title ASC",
  );
  return rows.map(normalizeEvent);
}

export async function listHiddenEvents(): Promise<AppEvent[]> {
  const all = await listEvents();
  return all.filter((e) => e.hidden);
}

export async function createEvent(input: NewEventInput): Promise<AppEvent> {
  const event: AppEvent = {
    id: uid(),
    title: input.title.trim(),
    type: input.type,
    month: input.month,
    day: input.day,
    year: input.year ?? null,
    notes: input.notes ?? null,
    link: input.link ?? null,
    remind_days: input.remind_days ?? null,
    sound_path: input.sound_path ?? null,
    photo_path: input.photo_path ?? null,
    tag: input.tag ?? null,
    source: input.source ?? "user",
    external_id: input.external_id ?? null,
    hidden: input.hidden ?? 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const db = await getDb();
  if (!db) {
    memory.events.push(event);
    return event;
  }

  await db.execute(
    `INSERT INTO events (id, title, type, month, day, year, notes, link, remind_days, sound_path, photo_path, tag, source, external_id, hidden, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      event.id,
      event.title,
      event.type,
      event.month,
      event.day,
      event.year,
      event.notes,
      event.link,
      event.remind_days,
      event.sound_path,
      event.photo_path,
      event.tag,
      event.source,
      event.external_id,
      event.hidden,
      event.created_at,
      event.updated_at,
    ],
  );
  return event;
}

export async function updateEvent(
  id: string,
  patch: Partial<Omit<AppEvent, "id" | "created_at">>,
): Promise<void> {
  const db = await getDb();
  const updatedAt = nowIso();
  if (!db) {
    const idx = memory.events.findIndex((e) => e.id === id);
    if (idx >= 0) memory.events[idx] = { ...memory.events[idx], ...patch, updated_at: updatedAt };
    return;
  }

  const current = (
    await db.select<AppEvent[]>("SELECT * FROM events WHERE id = $1", [id])
  )[0];
  if (!current) return;
  const next = normalizeEvent({ ...current, ...patch, updated_at: updatedAt });
  await db.execute(
    `UPDATE events SET title=$1, type=$2, month=$3, day=$4, year=$5, notes=$6, link=$7,
     remind_days=$8, sound_path=$9, photo_path=$10, tag=$11, source=$12, external_id=$13, hidden=$14, updated_at=$15
     WHERE id=$16`,
    [
      next.title,
      next.type,
      next.month,
      next.day,
      next.year,
      next.notes,
      next.link,
      next.remind_days,
      next.sound_path,
      next.photo_path,
      next.tag,
      next.source,
      next.external_id,
      next.hidden,
      next.updated_at,
      id,
    ],
  );
}

export async function deleteEvent(id: string): Promise<void> {
  const db = await getDb();
  if (!db) {
    memory.events = memory.events.filter((e) => e.id !== id);
    return;
  }
  await db.execute("DELETE FROM events WHERE id = $1", [id]);
}

/** Удаляет все не-пользовательские записи (праздники/саммиты), дни рождения не трогает */
export async function clearNonUserHolidays(): Promise<void> {
  const db = await getDb();
  if (!db) {
    memory.events = memory.events.filter((e) => e.source === "user");
    return;
  }
  await db.execute(`DELETE FROM events WHERE source != 'user'`);
}

export async function hideEvent(id: string, hidden: boolean): Promise<void> {
  await updateEvent(id, { hidden: hidden ? 1 : 0 });
}

export async function upsertHoliday(input: {
  title: string;
  month: number;
  day: number;
  year?: number | null;
  external_id: string;
  notes?: string | null;
  source?: EventSource;
  type?: EventType;
}): Promise<void> {
  const source: EventSource = input.source ?? "observance";
  const type: EventType = input.type ?? "holiday";
  const year = input.year ?? null;
  const db = await getDb();
  if (!db) {
    const existing = memory.events.find((e) => e.external_id === input.external_id);
    if (existing) {
      existing.title = input.title;
      existing.month = input.month;
      existing.day = input.day;
      existing.year = year;
      existing.notes = input.notes ?? null;
      existing.source = source;
      existing.type = type;
      existing.updated_at = nowIso();
      return;
    }
    await createEvent({
      title: input.title,
      type,
      month: input.month,
      day: input.day,
      year,
      notes: input.notes,
      source,
      external_id: input.external_id,
    });
    return;
  }

  const rows = await db.select<AppEvent[]>(
    "SELECT * FROM events WHERE external_id = $1",
    [input.external_id],
  );
  if (rows.length) {
    await updateEvent(rows[0].id, {
      title: input.title,
      month: input.month,
      day: input.day,
      year,
      notes: input.notes ?? null,
      type,
      source,
    });
    return;
  }
  await createEvent({
    title: input.title,
    type,
    month: input.month,
    day: input.day,
    year,
    notes: input.notes,
    source,
    external_id: input.external_id,
  });
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  if (!db) return { ...memory.settings };
  const rows = await db.select<AppSettings[]>("SELECT * FROM settings WHERE id = 1");
  const row = rows[0];
  if (!row) return defaultSettings();
  return { ...defaultSettings(), ...row };
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  const db = await getDb();
  if (!db) {
    memory.settings = next;
    return next;
  }
  await db.execute(
    `UPDATE settings SET country_code=$1, remind_days=$2, autostart=$3, theme=$4,
     sound_enabled=$5, start_minimized=$6, holidays_synced_at=$7, show_yesterday=$8,
     show_ticker=$9, show_holidays=$10, show_personal=$11, always_on_top=$12, font_size=$13,
     global_hotkey=$14, accent=$15, sort_mode=$16, repeat_on_day=$17, window_size=$18,
     glass_opacity=$19 WHERE id=1`,
    [
      next.country_code,
      next.remind_days,
      next.autostart,
      next.theme,
      next.sound_enabled,
      next.start_minimized,
      next.holidays_synced_at,
      next.show_yesterday,
      next.show_ticker,
      next.show_holidays,
      next.show_personal,
      next.always_on_top,
      next.font_size ?? 14,
      next.global_hotkey ?? 1,
      next.accent || "sage",
      next.sort_mode || "soon",
      next.repeat_on_day ?? 1,
      next.window_size || "normal",
      next.glass_opacity ?? 88,
    ],
  );
  return next;
}

export async function initDb(): Promise<void> {
  await getDb();
}
