import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export function photoSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
}

export async function pickAndStorePhoto(eventId: string): Promise<string | null> {
  const path = await open({
    multiple: false,
    filters: [{ name: "Изображения", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
  });
  if (!path || Array.isArray(path)) return null;
  return invoke<string>("copy_to_photos", { source: path, id: eventId });
}

/** Сбрасывает photo_path и удаляет файл из папки photos приложения. */
export async function clearEventPhoto(
  eventId: string,
  photoPath: string | null | undefined,
  update: (id: string, patch: { photo_path: null }) => Promise<unknown>,
): Promise<void> {
  await update(eventId, { photo_path: null });
  if (photoPath) {
    try {
      await invoke("remove_photo_file", { path: photoPath });
    } catch {
      /* файл мог уже отсутствовать */
    }
  }
}

export async function pickSoundFile(): Promise<string | null> {
  const path = await open({
    multiple: false,
    filters: [{ name: "Звук", extensions: ["mp3", "wav", "ogg", "m4a"] }],
  });
  if (!path || Array.isArray(path)) return null;
  return path;
}

export function matchesSearch(
  event: { title: string; notes: string | null },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    event.title.toLowerCase().includes(q) ||
    (event.notes?.toLowerCase().includes(q) ?? false)
  );
}
