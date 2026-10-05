import { LogicalSize } from "@tauri-apps/api/dpi";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type WindowSizeId = "compact" | "normal" | "large";

export const WINDOW_SIZES: { id: WindowSizeId; label: string; width: number; height: number }[] = [
  { id: "compact", label: "Компакт", width: 360, height: 500 },
  { id: "normal", label: "Обычный", width: 420, height: 560 },
  { id: "large", label: "Крупный", width: 500, height: 680 },
];

export async function applyWindowSize(id: string | null | undefined) {
  const preset = WINDOW_SIZES.find((s) => s.id === id) ?? WINDOW_SIZES[1];
  try {
    const win = getCurrentWindow();
    await win.setSize(new LogicalSize(preset.width, preset.height));
  } catch {
    /* browser */
  }
}
