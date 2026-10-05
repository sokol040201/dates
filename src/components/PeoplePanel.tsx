import { useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { AppEvent, EventTag, EventType, ImportReport } from "../types";
import { TAG_OPTIONS } from "../types";
import { createEvent, deleteEvent, updateEvent } from "../lib/db";
import { parseBulkPeople } from "../lib/birthdayMillenniumTxt";
import {
  eventsToCsv,
  eventsToJson,
  eventsToTxt,
  importCsvContent,
  importJsonContent,
  importTxtContent,
} from "../lib/importExport";
import { formatShortDate } from "../lib/dates";
import { clearEventPhoto, matchesSearch, photoSrc, pickAndStorePhoto } from "../lib/media";
import { EmptyState } from "./EmptyState";
import {
  IconCamera,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconUserPlus,
} from "./Icons";
import { Select } from "./ui";

interface Props {
  events: AppEvent[];
  onClose: () => void;
  onChanged: () => Promise<void>;
  initialEditId?: string | null;
}

type Mode = "list" | "form";

function typeLabel(t: EventType): string {
  if (t === "holiday") return "праздник";
  if (t === "custom") return "своё";
  return "ДР";
}

function initials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function PeoplePanel({ events, onClose, onChanged, initialEditId = null }: Props) {
  const [mode, setMode] = useState<Mode>(initialEditId ? "form" : "list");
  const [editId, setEditId] = useState<string | null>(initialEditId);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [eventType, setEventType] = useState<EventType>("birthday");
  const [tag, setTag] = useState<EventTag>("");
  const [remindDays, setRemindDays] = useState("");
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [bulk, setBulk] = useState("");
  const [importType, setImportType] = useState<EventType>("birthday");
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const allPeople = useMemo(
    () => events.filter((e) => e.source === "user" && !e.hidden),
    [events],
  );
  const people = useMemo(
    () =>
      allPeople
        .filter((e) => matchesSearch(e, query))
        .sort((a, b) => a.title.localeCompare(b.title, "ru")),
    [allPeople, query],
  );

  function resetFormFields() {
    setEditId(null);
    setTitle("");
    setDay("");
    setMonth("");
    setYear("");
    setRemindDays("");
    setNotes("");
    setLink("");
    setTag("");
    setEventType("birthday");
    setPhotoPath(null);
  }

  function goList() {
    resetFormFields();
    setMode("list");
    setShowImport(false);
  }

  function startCreate() {
    resetFormFields();
    setMode("form");
  }

  function startEdit(p: AppEvent) {
    setEditId(p.id);
    setTitle(p.title);
    setDay(String(p.day));
    setMonth(String(p.month));
    setYear(p.year != null ? String(p.year) : "");
    setEventType(p.type);
    setTag((p.tag as EventTag) || "");
    setRemindDays(p.remind_days != null ? String(p.remind_days) : "");
    setNotes(p.notes ?? "");
    setLink(p.link ?? "");
    setPhotoPath(p.photo_path);
    setMode("form");
  }

  useEffect(() => {
    if (!initialEditId) return;
    const found = events.find((e) => e.id === initialEditId);
    if (found) startEdit(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditId]);

  // Подтянуть свежее фото при обновлении списка, если редактируем
  useEffect(() => {
    if (!editId) return;
    const found = events.find((e) => e.id === editId);
    if (found) setPhotoPath(found.photo_path);
  }, [events, editId]);

  async function saveOne(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !day || !month) return;
    const d = Number(day);
    const m = Number(month);
    if (!Number.isFinite(d) || !Number.isFinite(m) || d < 1 || d > 31 || m < 1 || m > 12) return;
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        type: eventType,
        day: d,
        month: m,
        year: year ? Number(year) : null,
        tag: tag || null,
        remind_days: remindDays.trim() === "" ? null : Number(remindDays),
        notes: notes.trim() || null,
        link: link.trim() || null,
      };
      if (editId) {
        await updateEvent(editId, payload);
      } else {
        await createEvent({ ...payload, source: "user" });
      }
      await onChanged();
      goList();
    } finally {
      setBusy(false);
    }
  }

  async function addBulk() {
    const bulkType = eventType === "holiday" ? "custom" : eventType;
    const { items, errors } = parseBulkPeople(bulk, bulkType);
    setBusy(true);
    try {
      for (const item of items) {
        await createEvent({
          ...item,
          type: eventType === "holiday" ? "holiday" : item.type,
          source: "user",
          tag: tag || null,
        });
      }
      setBulk("");
      setReport({ imported: items.length, skipped: 0, errors });
      await onChanged();
      setShowImport(false);
    } finally {
      setBusy(false);
    }
  }

  async function importFile() {
    const path = await open({
      multiple: false,
      filters: [{ name: "TXT / CSV / JSON", extensions: ["txt", "csv", "json"] }],
    });
    if (!path || Array.isArray(path)) return;
    setBusy(true);
    try {
      const read = await invoke<{ text: string; encoding: string }>("read_text_auto", { path });
      const lower = path.toLowerCase();
      let result: ImportReport;
      if (lower.endsWith(".txt")) result = await importTxtContent(read.text, importType, read.encoding);
      else if (lower.endsWith(".csv")) result = await importCsvContent(read.text);
      else result = await importJsonContent(read.text);
      setReport(result);
      await onChanged();
    } catch (err) {
      setReport({ imported: 0, skipped: 0, errors: [String(err)] });
    } finally {
      setBusy(false);
    }
  }

  async function exportAs(kind: "txt" | "csv" | "json") {
    const filters =
      kind === "txt"
        ? [{ name: "TXT", extensions: ["txt"] }]
        : kind === "csv"
          ? [{ name: "CSV", extensions: ["csv"] }]
          : [{ name: "JSON", extensions: ["json"] }];
    const path = await save({
      defaultPath: `events.${kind}`,
      filters,
    });
    if (!path) return;
    const content =
      kind === "txt" ? eventsToTxt(events) : kind === "csv" ? eventsToCsv(events) : eventsToJson(events);
    await invoke("write_text_utf8", { path, content });
    setReport({ imported: allPeople.length, skipped: 0, errors: [`Сохранено: ${path}`] });
  }

  const photoPreview = photoSrc(photoPath);
  const headTitle = mode === "list" ? "Ваши события" : editId ? "Редактирование" : "Новое событие";

  return (
    <div className="overlay">
      <div className="overlay-head">
        <div className="overlay-head-title">
          {mode === "form" ? (
            <button type="button" className="win-btn" onClick={goList} title="К списку">
              <IconChevronLeft size={16} />
            </button>
          ) : null}
          <strong>{headTitle}</strong>
          {mode === "list" ? <span className="version-badge">{allPeople.length}</span> : null}
        </div>
        <button type="button" className="win-btn" onClick={onClose} title="Закрыть">
          <IconClose size={15} />
        </button>
      </div>

      {mode === "list" ? (
        <div className="overlay-body people-panel people-panel-list">
          <div className="people-toolbar">
            <label className="people-search">
              <IconSearch size={15} />
              <input
                className="field"
                placeholder="Поиск…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <button type="button" className="btn primary people-add-btn" onClick={startCreate}>
              <IconPlus size={16} />
              Добавить
            </button>
          </div>

          <div className="people-list">
            {people.map((p) => {
              const src = photoSrc(p.photo_path);
              return (
                <div key={p.id} className="people-item">
                  <button type="button" className="people-main" onClick={() => startEdit(p)}>
                    {src ? (
                      <img className="people-avatar" src={src} alt="" />
                    ) : (
                      <span className="people-avatar placeholder">{initials(p.title)}</span>
                    )}
                    <span className="people-text">
                      <span className="row-title">{p.title}</span>
                      <span className="row-meta">
                        {formatShortDate(p.month, p.day, p.year)}
                        {" · "}
                        {typeLabel(p.type)}
                        {p.tag
                          ? ` · ${TAG_OPTIONS.find((t) => t.value === p.tag)?.label ?? p.tag}`
                          : ""}
                      </span>
                    </span>
                    <IconChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn people-delete"
                    title="Удалить"
                    onClick={async (ev) => {
                      ev.stopPropagation();
                      if (editId === p.id) goList();
                      await deleteEvent(p.id);
                      await onChanged();
                    }}
                  >
                    <IconTrash size={15} />
                  </button>
                </div>
              );
            })}
            {!people.length &&
              (query.trim() && allPeople.length > 0 ? (
                <EmptyState
                  icon={<IconSearch size={18} />}
                  title="Ничего не найдено"
                  description="Измените запрос"
                  action={{ label: "Сбросить", onClick: () => setQuery("") }}
                />
              ) : (
                <EmptyState
                  icon={<IconUserPlus size={18} />}
                  title="Пока пусто"
                  description="Добавьте день рождения или важное событие"
                  action={{ label: "Добавить", onClick: startCreate }}
                />
              ))}
          </div>

          <div className="people-footer">
            <button
              type="button"
              className="btn"
              onClick={() => setShowImport((v) => !v)}
            >
              <IconUpload size={15} />
              {showImport ? "Скрыть импорт" : "Импорт / экспорт"}
            </button>
          </div>

          {showImport && (
            <div className="stack people-import">
              <textarea
                className="field"
                style={{ minHeight: 72, resize: "vertical" }}
                placeholder={"Иван 15.03.1990\nМария, 1992-07-21"}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
              />
              <button className="btn" type="button" disabled={busy || !bulk.trim()} onClick={addBulk}>
                Добавить пачкой
              </button>
              <Select
                label="Импорт TXT как"
                value={importType}
                onChange={setImportType}
                options={[
                  { value: "birthday", label: "Дни рождения" },
                  { value: "custom", label: "Свои события" },
                  { value: "holiday", label: "Праздники" },
                ]}
              />
              <div className="actions">
                <button className="btn primary" type="button" onClick={importFile} disabled={busy}>
                  Импорт файла
                </button>
                <button className="btn" type="button" onClick={() => exportAs("txt")}>
                  TXT
                </button>
                <button className="btn" type="button" onClick={() => exportAs("csv")}>
                  CSV
                </button>
                <button className="btn" type="button" onClick={() => exportAs("json")}>
                  JSON
                </button>
              </div>
            </div>
          )}

          {report && (
            <p className="muted people-report">
              Импорт: {report.imported}
              {report.encoding ? ` · ${report.encoding}` : ""}
              {report.errors.slice(0, 2).map((err) => (
                <span key={err} style={{ display: "block" }}>
                  {err}
                </span>
              ))}
            </p>
          )}
        </div>
      ) : (
        <form className="people-form-shell" onSubmit={saveOne}>
          <div className="people-form-scroll stack">
            <div className="people-photo-row">
              {photoPreview ? (
                <img className="people-photo-preview" src={photoPreview} alt="" />
              ) : (
                <span className="people-photo-preview placeholder">{initials(title || "?")}</span>
              )}
              <div className="people-photo-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !editId}
                  title={editId ? "Выбрать фото" : "Сначала сохраните запись"}
                  onClick={async () => {
                    if (!editId) return;
                    try {
                      const path = await pickAndStorePhoto(editId);
                      if (path) {
                        setPhotoPath(path);
                        await updateEvent(editId, { photo_path: path });
                        await onChanged();
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  <IconCamera size={16} />
                  {photoPath ? "Сменить" : "Фото"}
                </button>
                {photoPath && editId ? (
                  <button
                    type="button"
                    className="btn ghost-danger"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        await clearEventPhoto(editId, photoPath, updateEvent);
                        setPhotoPath(null);
                        await onChanged();
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    Убрать
                  </button>
                ) : null}
              </div>
            </div>
            {!editId && (
              <p className="muted" style={{ margin: 0 }}>
                Фото можно добавить после сохранения.
              </p>
            )}

            <input
              className="field"
              placeholder="Имя или название"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            <Select
              label="Тип"
              value={eventType}
              onChange={setEventType}
              options={[
                { value: "birthday", label: "День рождения" },
                { value: "custom", label: "Своё событие" },
                { value: "holiday", label: "Праздник" },
              ]}
            />
            <Select label="Метка" value={tag} onChange={setTag} options={TAG_OPTIONS} />
            <div className="people-date-grid">
              <label className="people-date-field">
                <span>День</span>
                <input
                  className="field"
                  inputMode="numeric"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  placeholder="15"
                />
              </label>
              <label className="people-date-field">
                <span>Месяц</span>
                <input
                  className="field"
                  inputMode="numeric"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="10"
                />
              </label>
              <label className="people-date-field">
                <span>Год</span>
                <input
                  className="field"
                  inputMode="numeric"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="необяз."
                />
              </label>
            </div>
            <input
              className="field"
              placeholder="Напомнить за N дней"
              value={remindDays}
              onChange={(e) => setRemindDays(e.target.value)}
            />
            <input
              className="field"
              placeholder="Заметка"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <input
              className="field"
              placeholder="Ссылка"
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>

          <div className="people-form-actions">
            <button className="btn primary" type="submit" disabled={busy || !title.trim() || !day || !month}>
              {editId ? "Сохранить" : "Создать"}
            </button>
            <button className="btn" type="button" onClick={goList}>
              Отмена
            </button>
            {editId ? (
              <button
                className="btn ghost-danger"
                type="button"
                disabled={busy}
                onClick={async () => {
                  await deleteEvent(editId);
                  await onChanged();
                  goList();
                }}
              >
                <IconTrash size={16} />
                Удалить
              </button>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}
