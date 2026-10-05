import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { AppEvent, AppSettings } from "../types";
import { createEvent, deleteEvent, getSettings, listEvents, updateSettings } from "./db";
import { syncHolidays } from "./holidays";

interface BackupPayload {
  version: 1;
  exported_at: string;
  settings: AppSettings;
  events: AppEvent[];
}

export async function exportBackup(): Promise<string | null> {
  const [settings, events] = await Promise.all([getSettings(), listEvents()]);
  const userEvents = events.filter((e) => e.source === "user");
  const payload: BackupPayload = {
    version: 1,
    exported_at: new Date().toISOString(),
    settings,
    events: userEvents,
  };
  const path = await save({
    defaultPath: `dates-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: "Backup JSON", extensions: ["json"] }],
  });
  if (!path) return null;
  await invoke("write_text_utf8", { path, content: JSON.stringify(payload, null, 2) });
  return path;
}

export async function importBackup(): Promise<{ restored: number; path: string }> {
  const path = await open({
    multiple: false,
    filters: [{ name: "Backup JSON", extensions: ["json"] }],
  });
  if (!path || Array.isArray(path)) {
    throw new Error("Файл не выбран");
  }
  const read = await invoke<{ text: string }>("read_text_auto", { path });
  let data: BackupPayload;
  try {
    data = JSON.parse(read.text) as BackupPayload;
  } catch {
    throw new Error("Невалидный JSON");
  }
  if (!data || !Array.isArray(data.events) || !data.settings) {
    throw new Error("Это не бэкап DATES");
  }

  const current = await listEvents();
  for (const e of current.filter((x) => x.source === "user")) {
    await deleteEvent(e.id);
  }

  const { holidays_synced_at: _hs, country_code: _cc, ...rest } = data.settings;
  await updateSettings(rest);

  let restored = 0;
  for (const e of data.events) {
    if (!e.title || !e.month || !e.day) continue;
    await createEvent({
      title: e.title,
      type: e.type || "birthday",
      month: Number(e.month),
      day: Number(e.day),
      year: e.year ?? null,
      notes: e.notes ?? null,
      link: e.link ?? null,
      remind_days: e.remind_days ?? null,
      sound_path: e.sound_path ?? null,
      photo_path: e.photo_path ?? null,
      tag: e.tag ?? null,
      source: "user",
      hidden: e.hidden ?? 0,
    });
    restored += 1;
  }

  await syncHolidays(true);
  return { restored, path };
}
