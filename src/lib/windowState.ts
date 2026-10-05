import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { availableMonitors, getCurrentWindow } from "@tauri-apps/api/window";
import { updateSettings } from "./db";

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let unlistenMoved: (() => void) | null = null;

/** Windows после hide() отдаёт (-32000,-32000) — такое сохранять нельзя. */
export function isPlausibleWindowPosition(x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x <= -10_000 || y <= -10_000) return false;
  if (Math.abs(x) > 50_000 || Math.abs(y) > 50_000) return false;
  return true;
}

async function isOnAnyMonitor(x: number, y: number, w = 120, h = 120): Promise<boolean> {
  try {
    const monitors = await availableMonitors();
    if (!monitors?.length) return true;
    return monitors.some((m) => {
      const left = m.position.x;
      const top = m.position.y;
      const right = left + m.size.width;
      const bottom = top + m.size.height;
      return x + w > left + 40 && x < right - 40 && y + h > top + 40 && y < bottom - 40;
    });
  } catch {
    return true;
  }
}

export async function applySkipTaskbar(hide: boolean) {
  try {
    await getCurrentWindow().setSkipTaskbar(hide);
  } catch {
    /* browser */
  }
}

export async function restoreWindowPosition(x: number | null | undefined, y: number | null | undefined) {
  const win = getCurrentWindow();
  if (x == null || y == null || !isPlausibleWindowPosition(x, y) || !(await isOnAnyMonitor(x, y))) {
    try {
      await win.center();
      // Сбрасываем битые координаты в БД
      if (x != null || y != null) {
        void updateSettings({ window_x: null, window_y: null });
      }
    } catch {
      /* browser */
    }
    return;
  }
  try {
    await win.setPosition(new PhysicalPosition(x, y));
  } catch {
    /* browser */
  }
}

export async function startWindowPositionTracking() {
  try {
    const win = getCurrentWindow();
    if (unlistenMoved) {
      unlistenMoved();
      unlistenMoved = null;
    }
    unlistenMoved = await win.onMoved(({ payload }) => {
      const x = Math.round(payload.x);
      const y = Math.round(payload.y);
      if (!isPlausibleWindowPosition(x, y)) return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void (async () => {
          if (!(await isOnAnyMonitor(x, y))) return;
          await updateSettings({ window_x: x, window_y: y });
        })();
      }, 400);
    });
  } catch {
    /* browser */
  }
}

export function stopWindowPositionTracking() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (unlistenMoved) {
    unlistenMoved();
    unlistenMoved = null;
  }
}
