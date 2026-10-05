import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listEvents, getSettings } from "./db";
import { relativeLabel, toUpcoming } from "./dates";

const NOTIFIED_KEY = "dates.notified";
const EVENING_HOUR = 18;

export type ReminderCheckMode = "startup" | "schedule";

function loadNotified(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveNotified(map: Record<string, string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(map));
}

function notifyKey(id: string, slot: string, year: number) {
  return `${id}:${year}:${slot}`;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const perm = await requestPermission();
      granted = perm === "granted";
    }
    return granted;
  } catch {
    return false;
  }
}

/**
 * mode=startup — только события на сегодня (без «завтра» / «через N дней»).
 * mode=schedule — полный цикл напоминаний в течение дня.
 */
export async function checkReminders(mode: ReminderCheckMode = "schedule"): Promise<number> {
  const settings = await getSettings();
  if (!(settings.notifications_enabled ?? 1)) return 0;

  const events = await listEvents();
  const upcoming = toUpcoming(events, settings.remind_days);
  const notified = loadNotified();
  const now = new Date();
  const year = now.getFullYear();
  const hour = now.getHours();
  let sent = 0;

  const granted = await ensureNotificationPermission();
  if (!granted) return 0;

  for (const item of upcoming) {
    const remindAt = item.event.remind_days ?? settings.remind_days;
    if (item.daysUntil > remindAt) continue;

    const slots: { slot: string; bodyPrefix: string }[] = [];

    if (mode === "startup") {
      // При запуске — только сегодняшний день
      if (item.daysUntil === 0) {
        slots.push({ slot: "day", bodyPrefix: "Сегодня" });
        if (settings.repeat_on_day && hour >= EVENING_HOUR) {
          slots.push({ slot: "day-evening", bodyPrefix: "Сегодня вечером" });
        }
      }
    } else {
      if (item.daysUntil === remindAt && item.daysUntil > 1) {
        slots.push({ slot: `in-${remindAt}`, bodyPrefix: relativeLabel(item.daysUntil) });
      }
      if (item.daysUntil === 1) {
        slots.push({ slot: "tomorrow", bodyPrefix: "Завтра" });
      }
      if (item.daysUntil === 0) {
        slots.push({ slot: "day", bodyPrefix: "Сегодня" });
        if (settings.repeat_on_day && hour >= EVENING_HOUR) {
          slots.push({ slot: "day-evening", bodyPrefix: "Сегодня вечером" });
        }
      }
    }

    for (const { slot, bodyPrefix } of slots) {
      const key = notifyKey(item.event.id, slot, year);
      if (notified[key]) continue;

      const agePart = item.age != null ? ` · ${item.age}` : "";
      const kind =
        item.event.type === "birthday"
          ? "день рождения"
          : item.event.type === "holiday"
            ? "праздник"
            : "событие";
      const body = `${bodyPrefix} · ${kind}${agePart}`;

      try {
        try {
          await invoke("show_app_notification", {
            title: item.event.title,
            body,
          });
        } catch {
          // fallback, если нативный вызов недоступен
          await sendNotification({ title: item.event.title, body });
        }
        if (settings.sound_enabled) {
          if (item.event.sound_path) playSoundFile(item.event.sound_path);
          else playChime();
        }
        notified[key] = new Date().toISOString();
        sent += 1;
      } catch {
        // ignore
      }
    }
  }

  saveNotified(notified);
  return sent;
}

function playSoundFile(path: string) {
  try {
    const url = convertFileSrc(path);
    const audio = new Audio(url);
    audio.volume = 0.6;
    void audio.play().catch(() => playChime());
  } catch {
    playChime();
  }
}

function playChime() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // ignore
  }
}

export function startReminderLoop(intervalMs = 30 * 60 * 1000): () => void {
  void checkReminders("startup");
  const id = window.setInterval(() => {
    void checkReminders("schedule");
  }, intervalMs);
  return () => window.clearInterval(id);
}
