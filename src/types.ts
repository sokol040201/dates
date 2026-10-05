export type EventType = "birthday" | "holiday" | "custom";
export type EventSource = "user" | "observance" | "nager";
export type EventTag = "" | "family" | "work" | "friends";

export interface AppEvent {
  id: string;
  title: string;
  type: EventType;
  month: number;
  day: number;
  year: number | null;
  notes: string | null;
  link: string | null;
  remind_days: number | null;
  sound_path: string | null;
  photo_path: string | null;
  tag: string | null;
  source: EventSource;
  external_id: string | null;
  hidden: number;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  country_code: string;
  remind_days: number;
  autostart: number;
  theme: "light" | "dark";
  sound_enabled: number;
  /** Системные Windows-уведомления */
  notifications_enabled: number;
  start_minimized: number;
  holidays_synced_at: string | null;
  show_yesterday: number;
  show_ticker: number;
  show_holidays: number;
  show_personal: number;
  always_on_top: number;
  /** Базовый размер шрифта в px (11–20) */
  font_size: number;
  /** Глобальный хоткей Ctrl+Shift+D */
  global_hotkey: number;
  /** Акцент: id пресета (sage, ocean…) или #RRGGBB */
  accent: string;
  /** soon | alpha | tag */
  sort_mode: string;
  /** Повторное уведомление вечером в день события */
  repeat_on_day: number;
  /** compact | normal | large */
  window_size: string;
  /** Прозрачность стекла 55–95 */
  glass_opacity: number;
  /** Скин: auto | none | winter | spring | summer | autumn */
  skin: string;
  /** Сохранённая позиция окна (логические координаты) */
  window_x: number | null;
  window_y: number | null;
  /** Скрыть кнопку из панели задач Windows */
  hide_from_taskbar: number;
}

export interface UpcomingEvent {
  event: AppEvent;
  daysUntil: number;
  nextDate: Date;
  age: number | null;
}

export interface ImportReport {
  imported: number;
  skipped: number;
  errors: string[];
  encoding?: string;
}

export type PanelId = "main" | "settings" | "people";

export const TAG_OPTIONS: { value: EventTag; label: string }[] = [
  { value: "", label: "Без метки" },
  { value: "family", label: "Семья" },
  { value: "work", label: "Работа" },
  { value: "friends", label: "Друзья" },
];

export function tagLabel(tag: string | null | undefined): string {
  if (!tag) return "";
  return TAG_OPTIONS.find((t) => t.value === tag)?.label ?? tag;
}
