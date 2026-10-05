import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; version: string }
  | { kind: "downloading" }
  | { kind: "uptodate" }
  | { kind: "error"; message: string };

const NOTIFIED_VERSION_KEY = "dates.update.notified";
/** Первая проверка через 8 с после старта — не мешаем UI. */
const STARTUP_DELAY_MS = 8_000;
/** Повторная проверка раз в 6 часов. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export async function checkForAppUpdate(opts?: {
  install?: boolean;
}): Promise<UpdateStatus> {
  try {
    const update = await check();
    if (!update) return { kind: "uptodate" };
    if (!opts?.install) {
      return { kind: "available", version: update.version };
    }
    await update.downloadAndInstall();
    await relaunch();
    return { kind: "downloading" };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

async function notifyUpdateAvailable(version: string) {
  try {
    const last = localStorage.getItem(NOTIFIED_VERSION_KEY);
    if (last === version) return;
    localStorage.setItem(NOTIFIED_VERSION_KEY, version);
    await invoke("show_app_notification", {
      title: "DATES",
      body: `Доступна версия ${version} — устанавливаю обновление…`,
    });
  } catch {
    /* ignore */
  }
}

/**
 * Фоновая автопроверка: при запуске и затем по расписанию.
 * Если есть обновление — уведомление и установка.
 */
export function startAutoUpdateCheck(): () => void {
  let stopped = false;
  let intervalId = 0;
  let timeoutId = 0;

  const run = async () => {
    if (stopped) return;
    try {
      const update = await check();
      if (stopped || !update) return;
      await notifyUpdateAvailable(update.version);
      if (stopped) return;
      await update.downloadAndInstall();
      await relaunch();
    } catch {
      // В dev / без сети — тихо пропускаем
    }
  };

  timeoutId = window.setTimeout(() => {
    void run();
    intervalId = window.setInterval(() => {
      void run();
    }, CHECK_INTERVAL_MS);
  }, STARTUP_DELAY_MS);

  return () => {
    stopped = true;
    window.clearTimeout(timeoutId);
    window.clearInterval(intervalId);
  };
}
