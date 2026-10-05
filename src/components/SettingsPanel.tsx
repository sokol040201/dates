import { useEffect, useState } from "react";
import { disable, enable } from "@tauri-apps/plugin-autostart";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AppEvent, AppSettings } from "../types";
import { hideEvent, listHiddenEvents, updateSettings } from "../lib/db";
import { syncHolidays } from "../lib/holidays";
import { ensureNotificationPermission } from "../lib/reminders";
import { ACCENT_THEMES, applyAccentTheme, DEFAULT_ACCENT } from "../lib/themes";
import { WINDOW_SIZES, applyWindowSize } from "../lib/windowSize";
import { exportBackup, importBackup } from "../lib/backup";
import { checkForAppUpdate } from "../lib/updater";
import { IconClose, IconDownload, IconMinus, IconPlus, IconUpload } from "./Icons";
import { getVersion } from "@tauri-apps/api/app";
import { SettingGroup, Switch } from "./ui";

const REMIND_PRESETS = [3, 7, 14, 30];

interface Props {
  settings: AppSettings;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onGlobalHotkeyChange?: (enabled: boolean) => Promise<void>;
}

export function SettingsPanel({ settings, onClose, onChanged, onGlobalHotkeyChange }: Props) {
  const [local, setLocal] = useState(settings);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState<AppEvent[]>([]);
  const [version, setVersion] = useState("1.0.0");

  useEffect(() => {
    void listHiddenEvents().then(setHidden);
    void getVersion()
      .then(setVersion)
      .catch(() => setVersion("1.0.0"));
  }, [settings]);

  async function save(patch: Partial<AppSettings>) {
    const next = await updateSettings(patch);
    setLocal(next);
    document.documentElement.dataset.theme = next.theme;
    const size = Math.min(20, Math.max(11, next.font_size || 14));
    document.documentElement.style.setProperty("--app-font-size", `${size}px`);
    const opacity = Math.min(95, Math.max(55, next.glass_opacity || 88));
    document.documentElement.style.setProperty("--glass-alpha", String(opacity / 100));
    applyAccentTheme(next.accent || DEFAULT_ACCENT, next.theme);
    if (patch.window_size) await applyWindowSize(next.window_size);
    await onChanged();
    return next;
  }

  async function pickAccent(id: string) {
    setLocal({ ...local, accent: id });
    applyAccentTheme(id, local.theme);
    await save({ accent: id });
  }

  async function bumpDays(delta: number) {
    const next = Math.min(364, Math.max(1, local.remind_days + delta));
    setLocal({ ...local, remind_days: next });
    await save({ remind_days: next });
  }

  async function bumpFont(delta: number) {
    const next = Math.min(20, Math.max(11, (local.font_size || 14) + delta));
    setLocal({ ...local, font_size: next });
    document.documentElement.style.setProperty("--app-font-size", `${next}px`);
    await save({ font_size: next });
  }

  return (
    <div className="overlay">
      <div className="overlay-head">
        <strong>Настройки</strong>
        <button type="button" className="win-btn" onClick={onClose} title="Закрыть">
          <IconClose size={15} />
        </button>
      </div>

      <div className="overlay-body">
        <SettingGroup title="Напоминания">
          <div className="chip-row">
            {REMIND_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                className={`chip ${local.remind_days === d ? "active" : ""}`}
                onClick={() => save({ remind_days: d })}
              >
                {d} дн.
              </button>
            ))}
          </div>
          <div className="row-setting">
            <span className="row-setting-label">За сколько дней</span>
            <div className="stepper">
              <button type="button" onClick={() => bumpDays(-1)} aria-label="Меньше">
                <IconMinus size={14} />
              </button>
              <input
                type="number"
                min={1}
                max={364}
                value={local.remind_days}
                onChange={(e) => setLocal({ ...local, remind_days: Number(e.target.value) })}
                onBlur={() => save({ remind_days: local.remind_days })}
              />
              <button type="button" onClick={() => bumpDays(1)} aria-label="Больше">
                <IconPlus size={14} />
              </button>
            </div>
          </div>
          <Switch
            label="Показывать «вчера»"
            checked={!!local.show_yesterday}
            onChange={(v) => save({ show_yesterday: v ? 1 : 0 })}
          />
          <Switch
            label="Звук уведомлений"
            checked={!!local.sound_enabled}
            onChange={(v) => save({ sound_enabled: v ? 1 : 0 })}
          />
          <Switch
            label="Повтор вечером в день события"
            checked={!!local.repeat_on_day}
            onChange={(v) => save({ repeat_on_day: v ? 1 : 0 })}
          />
        </SettingGroup>

        <SettingGroup title="Оформление">
          <div className="select-label">Цвет акцента</div>
          <div className="swatch-row">
            {ACCENT_THEMES.map((t) => {
              const current = local.accent || DEFAULT_ACCENT;
              const active = !current.startsWith("#") && current === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`swatch ${active ? "active" : ""}`}
                  style={{ background: local.theme === "dark" ? t.accentDark : t.accent }}
                  title={t.label}
                  aria-label={t.label}
                  onClick={() => pickAccent(t.id)}
                />
              );
            })}
            <label
              className={`swatch custom ${(local.accent || "").startsWith("#") ? "active" : ""}`}
              title="Свой цвет"
            >
              <input
                type="color"
                value={
                  (local.accent || "").startsWith("#")
                    ? local.accent
                    : ACCENT_THEMES.find((t) => t.id === (local.accent || DEFAULT_ACCENT))?.accent ||
                      "#2f6f6a"
                }
                onChange={(e) => {
                  const hex = e.target.value;
                  setLocal({ ...local, accent: hex });
                  applyAccentTheme(hex, local.theme);
                }}
                onBlur={(e) => {
                  void pickAccent(e.target.value);
                }}
              />
            </label>
          </div>
          <div className="row-setting">
            <span className="row-setting-label">Размер шрифта</span>
            <div className="stepper">
              <button type="button" onClick={() => bumpFont(-1)} aria-label="Меньше шрифт">
                <IconMinus size={14} />
              </button>
              <input
                type="number"
                min={11}
                max={20}
                value={local.font_size || 14}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setLocal({ ...local, font_size: v });
                  if (v >= 11 && v <= 20) {
                    document.documentElement.style.setProperty("--app-font-size", `${v}px`);
                  }
                }}
                onBlur={() => {
                  const v = Math.min(20, Math.max(11, local.font_size || 14));
                  void save({ font_size: v });
                }}
              />
              <button type="button" onClick={() => bumpFont(1)} aria-label="Больше шрифт">
                <IconPlus size={14} />
              </button>
            </div>
          </div>
          <div className="select-label">Размер окна</div>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {WINDOW_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip ${(local.window_size || "normal") === s.id ? "active" : ""}`}
                onClick={() => save({ window_size: s.id })}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="row-setting">
            <span className="row-setting-label">
              Прозрачность стекла ({local.glass_opacity || 88}%)
            </span>
            <input
              className="range"
              type="range"
              min={55}
              max={95}
              value={local.glass_opacity || 88}
              onChange={(e) => {
                const v = Number(e.target.value);
                setLocal((prev) => ({ ...prev, glass_opacity: v }));
                document.documentElement.style.setProperty("--glass-alpha", String(v / 100));
              }}
              onPointerUp={(e) => {
                const v = Number((e.target as HTMLInputElement).value);
                void save({ glass_opacity: v });
              }}
            />
          </div>
          <Switch
            label="Светлое стекло"
            checked={local.theme === "light"}
            onChange={(v) => save({ theme: v ? "light" : "dark" })}
          />
          <Switch
            label="Бегущая строка"
            checked={!!local.show_ticker}
            onChange={(v) => save({ show_ticker: v ? 1 : 0 })}
          />
          <Switch
            label="Поверх других окон"
            checked={!!local.always_on_top}
            onChange={async (v) => {
              await save({ always_on_top: v ? 1 : 0 });
              try {
                await getCurrentWindow().setAlwaysOnTop(v);
              } catch {
                /* browser */
              }
            }}
          />
          <Switch
            label="Старт в трее"
            checked={!!local.start_minimized}
            onChange={(v) => save({ start_minimized: v ? 1 : 0 })}
          />
          <Switch
            label="Глобальный хоткей Ctrl+Shift+D"
            checked={!!local.global_hotkey}
            onChange={async (v) => {
              await save({ global_hotkey: v ? 1 : 0 });
              await onGlobalHotkeyChange?.(v);
            }}
          />
          <Switch
            label="Автозапуск с Windows"
            checked={!!local.autostart}
            onChange={async (v) => {
              try {
                if (v) await enable();
                else await disable();
                await save({ autostart: v ? 1 : 0 });
              } catch (err) {
                setStatus(err instanceof Error ? err.message : String(err));
              }
            }}
          />
        </SettingGroup>

        <SettingGroup title="Разделы">
          <Switch
            label="Знаменательные даты"
            checked={!!local.show_holidays}
            onChange={(v) => save({ show_holidays: v ? 1 : 0 })}
          />
          <Switch
            label="Запланированные события"
            checked={!!local.show_personal}
            onChange={(v) => save({ show_personal: v ? 1 : 0 })}
          />
        </SettingGroup>

        <SettingGroup title="Данные">
          <div className="actions" style={{ padding: "10px 0" }}>
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await syncHolidays(true);
                  setStatus(`Обновлено записей: ${r.count}`);
                  await onChanged();
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Обновить праздники
            </button>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                const ok = await ensureNotificationPermission();
                setStatus(ok ? "Уведомления разрешены" : "Нет доступа к уведомлениям");
              }}
            >
              Уведомления
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const path = await exportBackup();
                  setStatus(path ? `Бэкап сохранён: ${path}` : "Сохранение отменено");
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <IconDownload size={15} /> Бэкап
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await importBackup();
                  setStatus(`Восстановлено событий: ${r.restored}`);
                  await onChanged();
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <IconUpload size={15} /> Восстановить
            </button>
          </div>
          {hidden.length > 0 && (
            <div className="hidden-list">
              <div className="select-label">Скрытые</div>
              {hidden.map((h) => (
                <div key={h.id} className="people-item">
                  <div className="row-title">{h.title}</div>
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      await hideEvent(h.id, false);
                      setHidden(await listHiddenEvents());
                      await onChanged();
                    }}
                  >
                    Вернуть
                  </button>
                </div>
              ))}
            </div>
          )}
        </SettingGroup>

        <SettingGroup title="Обновления">
          <p className="muted" style={{ marginTop: 0 }}>
            Версия {version}. Обновления приходят с GitHub Releases.
          </p>
          <div className="actions" style={{ padding: "4px 0 10px" }}>
            <button
              type="button"
              className="btn primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setStatus("Проверка обновлений…");
                try {
                  const r = await checkForAppUpdate({ install: false });
                  if (r.kind === "uptodate") {
                    setStatus("У вас актуальная версия");
                  } else if (r.kind === "available") {
                    setStatus(`Доступна ${r.version} — устанавливаю…`);
                    await checkForAppUpdate({ install: true });
                  } else if (r.kind === "error") {
                    setStatus(r.message);
                  }
                } catch (err) {
                  setStatus(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Проверить обновления
            </button>
          </div>
        </SettingGroup>

        <p className="muted">
          Праздники и именины — каталог. События — ваши дни рождения, свои даты и праздники.
          Горячие клавиши: Ctrl+, настройки · Ctrl+N события · Esc закрыть.
        </p>
        {status && <p className="muted">{status}</p>}
      </div>
    </div>
  );
}
