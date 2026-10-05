import { NAMEDAYS } from "../data/namedays";
import { OBSERVANCES } from "../data/observances";
import {
  clearNonUserHolidays,
  getSettings,
  hideEvent,
  insertHolidayCatalog,
  listEvents,
  updateSettings,
} from "./db";

const CATALOG_VERSION = 5;
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Только русскоязычные тематические дни — как «какой сегодня праздник» */
export async function shouldSyncHolidays(): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.holidays_synced_at) return true;
  if (settings.country_code !== `OBS-v${CATALOG_VERSION}`) return true;
  const synced = new Date(settings.holidays_synced_at).getTime();
  if (Date.now() - synced > CACHE_MAX_AGE_MS) return true;
  const events = await listEvents();
  const hasJunk = events.some(
    (e) =>
      e.source === "nager" ||
      (e.external_id?.startsWith("world-") ?? false) ||
      (e.type === "holiday" &&
        e.source === "observance" &&
        !e.external_id?.startsWith("obs-") &&
        !e.external_id?.startsWith("name-")),
  );
  if (hasJunk) return true;
  const hasObs = events.some((e) => e.source === "observance" && e.external_id?.startsWith("obs-"));
  const hasNames = events.some(
    (e) => e.source === "observance" && e.external_id?.startsWith("name-"),
  );
  return !hasObs || !hasNames;
}

export async function syncHolidays(force = false): Promise<{ count: number }> {
  if (!force && !(await shouldSyncHolidays())) {
    return { count: 0 };
  }

  const before = await listEvents();
  const hiddenExt = new Set(
    before.filter((e) => e.hidden && e.external_id).map((e) => e.external_id as string),
  );

  await clearNonUserHolidays();

  const catalog = [
    ...OBSERVANCES.map((o) => ({
      title: o.title,
      month: o.month,
      day: o.day,
      year: null as number | null,
      external_id: `obs-${o.month}-${o.day}-${o.title}`,
      notes: o.note ?? null,
      source: "observance" as const,
      type: "holiday" as const,
    })),
    ...NAMEDAYS.map((n) => ({
      title: `Именины: ${n.name}`,
      month: n.month,
      day: n.day,
      year: null as number | null,
      external_id: `name-${n.month}-${n.day}-${n.name}`,
      notes: `День имени ${n.name}`,
      source: "observance" as const,
      type: "holiday" as const,
    })),
  ];

  const count = await insertHolidayCatalog(catalog);

  if (hiddenExt.size) {
    const after = await listEvents();
    for (const e of after) {
      if (e.external_id && hiddenExt.has(e.external_id)) {
        await hideEvent(e.id, true);
      }
    }
  }

  await updateSettings({
    holidays_synced_at: new Date().toISOString(),
    country_code: `OBS-v${CATALOG_VERSION}`,
  });
  return { count };
}

export function isSignificantEvent(e: {
  source: string;
  type: string;
  external_id: string | null;
}): boolean {
  if (e.external_id?.startsWith("obs-") || e.external_id?.startsWith("name-")) return true;
  return e.source === "user" && e.type === "holiday";
}

export function isPersonalEvent(e: { source: string; type: string }): boolean {
  return e.source === "user" && e.type !== "holiday";
}
