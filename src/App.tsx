import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { TitleBar } from "./components/TitleBar";
import { StatusBar } from "./components/StatusBar";
import { EventList } from "./components/EventList";
import { SettingsPanel } from "./components/SettingsPanel";
import { PeoplePanel } from "./components/PeoplePanel";
import { DayCard } from "./components/DayCard";
import { MonthCalendar } from "./components/MonthCalendar";
import { GlassFrame } from "./components/GlassFrame";
import { EmptyState } from "./components/EmptyState";
import { IconCalendar, IconList, IconSearch, IconUserPlus } from "./components/Icons";
import { getSettings, initDb, listEvents, updateSettings } from "./lib/db";
import { isPersonalEvent, isSignificantEvent, shouldSyncHolidays, syncHolidays } from "./lib/holidays";
import { startReminderLoop } from "./lib/reminders";
import { toUpcoming } from "./lib/dates";
import { matchesSearch } from "./lib/media";
import { applyAccentTheme, DEFAULT_ACCENT } from "./lib/themes";
import { applySkin, resolveSkin } from "./lib/skins";
import { SORT_OPTIONS, sortUpcoming, type SortMode } from "./lib/sort";
import { applyWindowSize } from "./lib/windowSize";
import {
  applySkipTaskbar,
  restoreWindowPosition,
  startWindowPositionTracking,
  stopWindowPositionTracking,
} from "./lib/windowState";
import { startAutoUpdateCheck } from "./lib/updater";
import type { AppEvent, AppSettings, EventTag, PanelId, UpcomingEvent } from "./types";
import { TAG_OPTIONS } from "./types";

const HOTKEY = "Control+Shift+D";

const defaultSettings: AppSettings = {
  country_code: "WORLD",
  remind_days: 14,
  autostart: 0,
  theme: "light",
  sound_enabled: 1,
  notifications_enabled: 1,
  start_minimized: 0,
  holidays_synced_at: null,
  show_yesterday: 1,
  show_ticker: 1,
  show_holidays: 1,
  show_personal: 1,
  always_on_top: 0,
  font_size: 14,
  global_hotkey: 1,
  accent: DEFAULT_ACCENT,
  sort_mode: "soon",
  repeat_on_day: 1,
  window_size: "normal",
  glass_opacity: 88,
  skin: "auto",
  window_x: null,
  window_y: null,
  hide_from_taskbar: 1,
};

function applyUiSettings(s: AppSettings) {
  document.documentElement.dataset.theme = s.theme;
  const size = Math.min(20, Math.max(11, s.font_size || 14));
  document.documentElement.style.setProperty("--app-font-size", `${size}px`);
  const opacity = Math.min(95, Math.max(55, s.glass_opacity || 88));
  document.documentElement.style.setProperty("--glass-alpha", String(opacity / 100));
  applyAccentTheme(s.accent || DEFAULT_ACCENT, s.theme);
  applySkin(s.skin || "auto", s.theme, () => {
    applyAccentTheme(s.accent || DEFAULT_ACCENT, s.theme);
  });
}

async function toggleMainWindow() {
  const win = getCurrentWindow();
  const visible = await win.isVisible();
  if (visible) await win.hide();
  else {
    await win.show();
    await win.unminimize();
    await win.setFocus();
  }
}

async function setupGlobalHotkey(enabled: boolean) {
  try {
    await unregisterAll();
    if (enabled) {
      await register(HOTKEY, () => {
        void toggleMainWindow();
      });
    }
  } catch {
    /* browser / unavailable */
  }
}

function App() {
  const [panel, setPanel] = useState<PanelId>("main");
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<EventTag | "all">("all");
  const [catalogFilter, setCatalogFilter] = useState<"all" | "holidays" | "namedays">("all");
  const [viewMode, setViewMode] = useState<"list" | "month">("list");
  const [selected, setSelected] = useState<UpcomingEvent | null>(null);
  const [peopleEditId, setPeopleEditId] = useState<string | null>(null);
  const [calCursor, setCalCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() + 1 };
  });
  const didStartMinimized = useRef(false);
  const didApplyWindowLayout = useRef(false);

  const refresh = useCallback(async () => {
    const [ev, st] = await Promise.all([listEvents(), getSettings()]);
    const normalized = {
      ...defaultSettings,
      ...st,
      font_size: st.font_size || 14,
      global_hotkey: st.global_hotkey ?? 1,
      accent: st.accent || DEFAULT_ACCENT,
      sort_mode: st.sort_mode || "soon",
      repeat_on_day: st.repeat_on_day ?? 1,
      window_size: st.window_size || "normal",
      glass_opacity: st.glass_opacity || 88,
      skin: st.skin || "auto",
      window_x: st.window_x ?? null,
      window_y: st.window_y ?? null,
      hide_from_taskbar: st.hide_from_taskbar ?? 1,
      notifications_enabled: st.notifications_enabled ?? 1,
    };
    setEvents(ev);
    setSettings(normalized);
    applyUiSettings(normalized);
    try {
      await getCurrentWindow().setAlwaysOnTop(!!normalized.always_on_top);
      await applySkipTaskbar(!!normalized.hide_from_taskbar);
      if (!didApplyWindowLayout.current) {
        didApplyWindowLayout.current = true;
        await applyWindowSize(normalized.window_size);
        await restoreWindowPosition(normalized.window_x, normalized.window_y);
        await startWindowPositionTracking();
      }
    } catch {
      /* browser */
    }
    return normalized;
  }, []);

  useEffect(() => {
    let stopReminders: (() => void) | undefined;
    let stopUpdates: (() => void) | undefined;
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        await initDb();
        const st = await refresh();
        if (!didStartMinimized.current && st.start_minimized) {
          didStartMinimized.current = true;
          try {
            // Скрываем только при автозапуске Windows, не при ручном открытии
            const viaAutostart = await invoke<boolean>("launched_via_autostart");
            if (viaAutostart) await getCurrentWindow().hide();
          } catch {
            /* browser */
          }
        }
        await setupGlobalHotkey(!!st.global_hotkey);
        try {
          if (await shouldSyncHolidays()) {
            await syncHolidays(true);
            await refresh();
          }
        } catch {
          /* ok */
        }
        stopReminders = startReminderLoop();
        stopUpdates = startAutoUpdateCheck();
        try {
          unlisten = await listen("dates://sync-holidays", async () => {
            await syncHolidays(true);
            await refresh();
          });
        } catch {
          /* not tauri */
        }
      } finally {
        setReady(true);
      }
    })();

    return () => {
      stopReminders?.();
      stopUpdates?.();
      unlisten?.();
      stopWindowPositionTracking();
      void unregisterAll().catch(() => undefined);
    };
  }, [refresh]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "Escape") {
        if (selected) {
          setSelected(null);
          e.preventDefault();
          return;
        }
        if (panel !== "main") {
          setPanel("main");
          e.preventDefault();
        }
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        setPanel("settings");
        return;
      }
      if (mod && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        setPeopleEditId(null);
        setPanel("people");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, selected]);

  const filterItem = useCallback(
    (item: UpcomingEvent) => {
      if (!matchesSearch(item.event, query)) return false;
      if (tagFilter !== "all" && (item.event.tag || "") !== tagFilter) return false;
      return true;
    },
    [query, tagFilter],
  );

  const sortMode = (settings.sort_mode || "soon") as SortMode;

  const significant = useMemo(() => {
    return sortUpcoming(
      toUpcoming(
        events.filter((e) => {
          if (!isSignificantEvent(e)) return false;
          if (catalogFilter === "namedays") return !!e.external_id?.startsWith("name-");
          if (catalogFilter === "holidays") {
            return (
              !!e.external_id?.startsWith("obs-") ||
              (e.source === "user" && e.type === "holiday")
            );
          }
          return true;
        }),
        settings.remind_days,
        new Date(),
        !!settings.show_yesterday,
      ).filter(filterItem),
      sortMode,
    );
  }, [events, settings.remind_days, settings.show_yesterday, catalogFilter, filterItem, sortMode]);

  const personal = useMemo(() => {
    return sortUpcoming(
      toUpcoming(
        events.filter((e) => isPersonalEvent(e)),
        settings.remind_days,
        new Date(),
        !!settings.show_yesterday,
      ).filter(filterItem),
      sortMode,
    );
  }, [events, settings.remind_days, settings.show_yesterday, filterItem, sortMode]);

  // Календарь: весь месяц, без обрезки по горизонту напоминаний
  const calendarItems = useMemo(() => {
    const catalog = events.filter((e) => {
      if (!isSignificantEvent(e)) return false;
      if (catalogFilter === "namedays") return !!e.external_id?.startsWith("name-");
      if (catalogFilter === "holidays") {
        return (
          !!e.external_id?.startsWith("obs-") ||
          (e.source === "user" && e.type === "holiday")
        );
      }
      return true;
    });
    const own = events.filter((e) => isPersonalEvent(e));
    return toUpcoming([...catalog, ...own], 366, new Date(), false).filter(filterItem);
  }, [events, catalogFilter, filterItem]);

  const filtersActive = !!query.trim() || tagFilter !== "all";
  const hasAnyPersonal = useMemo(
    () => events.some((e) => !e.hidden && isPersonalEvent(e)),
    [events],
  );
  const hasAnyCatalog = useMemo(
    () => events.some((e) => !e.hidden && isSignificantEvent(e)),
    [events],
  );

  const todayEvents = useMemo(() => {
    const n = new Date();
    return events.filter((e) => !e.hidden && e.month === n.getMonth() + 1 && e.day === n.getDate());
  }, [events]);

  function clearListFilters() {
    setQuery("");
    setTagFilter("all");
    setCatalogFilter("all");
  }

  useEffect(() => {
    if (!selected) return;
    const fresh = events.find((e) => e.id === selected.event.id);
    if (!fresh || fresh.hidden) {
      setSelected(null);
      return;
    }
    if (fresh === selected.event) return;
    const next = toUpcoming([fresh], settings.remind_days, new Date(), !!settings.show_yesterday)[0];
    if (next) setSelected(next);
  }, [events, selected, settings.remind_days, settings.show_yesterday]);

  const activeSkin = resolveSkin(settings.skin);

  if (!ready) {
    return (
      <GlassFrame skin={activeSkin}>
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
          <span className="muted">DATES…</span>
        </div>
      </GlassFrame>
    );
  }

  return (
    <GlassFrame skin={activeSkin}>
      <TitleBar
        onOpenSettings={() => setPanel("settings")}
        onOpenPeople={() => {
          setPeopleEditId(null);
          setPanel("people");
        }}
      />

      <div className="toolbar">
        <label className="search-wrap">
          <IconSearch size={14} />
          <input
            className="search-input"
            placeholder="Поиск…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="seg">
          <button
            type="button"
            className={`seg-btn ${viewMode === "list" ? "active" : ""}`}
            title="Список"
            onClick={() => setViewMode("list")}
          >
            <IconList size={15} />
          </button>
          <button
            type="button"
            className={`seg-btn ${viewMode === "month" ? "active" : ""}`}
            title="Месяц"
            onClick={() => setViewMode("month")}
          >
            <IconCalendar size={15} />
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <button
          type="button"
          className={`chip ${tagFilter === "all" ? "active" : ""}`}
          onClick={() => setTagFilter("all")}
        >
          Все
        </button>
        {TAG_OPTIONS.filter((t) => t.value).map((t) => (
          <button
            key={t.value}
            type="button"
            className={`chip ${tagFilter === t.value ? "active" : ""}`}
            onClick={() => setTagFilter(t.value)}
          >
            {t.label}
          </button>
        ))}
        <span className="filter-sep" aria-hidden />
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`chip ${sortMode === s.value ? "active" : ""}`}
            onClick={() => {
              void updateSettings({ sort_mode: s.value }).then((next) => {
                setSettings((prev) => ({ ...prev, ...next }));
              });
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="panel-body">
        {viewMode === "month" ? (
          <section className="section">
            <div className="scroll-area">
              <MonthCalendar
                items={calendarItems}
                year={calCursor.year}
                month={calCursor.month}
                onPrev={() =>
                  setCalCursor((c) =>
                    c.month === 1
                      ? { year: c.year - 1, month: 12 }
                      : { year: c.year, month: c.month - 1 },
                  )
                }
                onNext={() =>
                  setCalCursor((c) =>
                    c.month === 12
                      ? { year: c.year + 1, month: 1 }
                      : { year: c.year, month: c.month + 1 },
                  )
                }
                onSelectDay={(_day, dayItems) => {
                  if (dayItems[0]) setSelected(dayItems[0]);
                }}
              />
            </div>
          </section>
        ) : (
          <>
            {!!settings.show_holidays && (
              <section className="section">
                <div className="section-head-row">
                  <div className="section-head">Знаменательные даты</div>
                  <div className="chip-row compact">
                    {(
                      [
                        ["all", "Все"],
                        ["holidays", "Праздники"],
                        ["namedays", "Именины"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={`chip ${catalogFilter === id ? "active" : ""}`}
                        onClick={() => setCatalogFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="scroll-area">
                  <EventList
                    items={significant}
                    onSelect={setSelected}
                    empty={
                      filtersActive || catalogFilter !== "all" ? (
                        <EmptyState
                          icon={<IconSearch size={18} />}
                          title="Ничего не найдено"
                          description={
                            hasAnyCatalog ? "Другой фильтр или сбросьте поиск" : "Нет дат в горизонте"
                          }
                          action={{ label: "Сбросить", onClick: clearListFilters }}
                        />
                      ) : (
                        <EmptyState
                          icon={<IconCalendar size={18} />}
                          title="Каталог пуст"
                          description="Загрузите праздники и именины"
                          action={{
                            label: "Обновить",
                            onClick: () => {
                              void (async () => {
                                try {
                                  await syncHolidays(true);
                                  await refresh();
                                } catch {
                                  setPanel("settings");
                                }
                              })();
                            },
                          }}
                          secondaryAction={{
                            label: "Настройки",
                            onClick: () => setPanel("settings"),
                          }}
                        />
                      )
                    }
                  />
                </div>
              </section>
            )}

            {!!settings.show_personal && (
              <section className="section">
                <div className="section-head">Запланированные события</div>
                <div className="scroll-area">
                  <EventList
                    items={personal}
                    personal
                    onSelect={setSelected}
                    empty={
                      filtersActive && hasAnyPersonal ? (
                        <EmptyState
                          icon={<IconSearch size={18} />}
                          title="Ничего не найдено"
                          description="Нет совпадений по поиску или тегу"
                          action={{ label: "Сбросить", onClick: clearListFilters }}
                        />
                      ) : (
                        <EmptyState
                          icon={<IconUserPlus size={18} />}
                          title="Нет своих событий"
                          description="Дни рождения и важные даты"
                          action={{
                            label: "Добавить",
                            onClick: () => {
                              setPeopleEditId(null);
                              setPanel("people");
                            },
                          }}
                        />
                      )
                    }
                  />
                </div>
              </section>
            )}
          </>
        )}
      </div>

      <StatusBar showTicker={!!settings.show_ticker} todayEvents={todayEvents} />

      {panel === "settings" && (
        <SettingsPanel
          settings={settings}
          onClose={() => setPanel("main")}
          onChanged={async () => {
            await refresh();
          }}
          onGlobalHotkeyChange={setupGlobalHotkey}
        />
      )}
      {panel === "people" && (
        <PeoplePanel
          events={events}
          initialEditId={peopleEditId}
          onClose={() => {
            setPeopleEditId(null);
            setPanel("main");
          }}
          onChanged={async () => {
            await refresh();
          }}
        />
      )}
      {selected && (
        <DayCard
          item={selected}
          defaultRemindDays={settings.remind_days}
          onClose={() => setSelected(null)}
          onChanged={async () => {
            await refresh();
          }}
          onEditFull={(id) => {
            setSelected(null);
            setPeopleEditId(id);
            setPanel("people");
          }}
        />
      )}
    </GlassFrame>
  );
}

export default App;
