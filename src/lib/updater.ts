import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available"; version: string }
  | { kind: "downloading" }
  | { kind: "uptodate" }
  | { kind: "error"; message: string };

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
