import { useMemo, useState } from "react";
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
import { matchesSearch, pickAndStorePhoto } from "../lib/media";
import { IconCamera, IconClose, IconEdit, IconTrash } from "./Icons";
import { Select } from "./ui";

interface Props {
  events: AppEvent[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function PeoplePanel({ events, onClose, onChanged }: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [eventType, setEventType] = useState<EventType>("birthday");
  const [tag, setTag] = useState<EventTag>("");
  const [remindDays, setRemindDays] = useState("");
  const [bulk, setBulk] = useState("");
  const [importType, setImportType] = useState<EventType>("birthday");
  const [query, setQuery] = useState("");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  const people = useMemo(
    () =>
      events
        .filter((e) => e.source === "user")
        .filter((e) => matchesSearch(e, query)),
    [events, query],
  );

  function clearForm() {
    setEditId(null);
    setTitle("");
    setDay("");
    setMonth("");
    setYear("");
    setRemindDays("");
    setTag("");
    setEventType("birthday");
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
  }

  async function saveOne(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !day || !month) return;
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        type: eventType,
        day: Number(day),
        month: Number(month),
        year: year ? Number(year) : null,
        tag: tag || null,
        remind_days: remindDays.trim() === "" ? null : Number(remindDays),
      };
      if (editId) {
        await updateEvent(editId, payload);
      } else {
        await createEvent({ ...payload, source: "user" });
      }
      clearForm();
      await onChanged();
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
    setReport({ imported: people.length, skipped: 0, errors: [`Сохранено: ${path}`] });
  }

  return (
    <div className="overlay">
      <div className="overlay-head">
        <strong>{editId ? "Редактирование" : "Ваши события"}</strong>
        <button type="button" className="win-btn" onClick={onClose} title="Закрыть">
          <IconClose size={15} />
        </button>
      </div>

      <div className="overlay-body stack">
        <form className="stack" onSubmit={saveOne}>
          <input
            className="field"
            placeholder="Имя / название"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <input className="field" placeholder="День" value={day} onChange={(e) => setDay(e.target.value)} />
            <input
              className="field"
              placeholder="Месяц"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <input className="field" placeholder="Год" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <input
            className="field"
            placeholder="Напомнить за N дней (пусто = как в настройках)"
            value={remindDays}
            onChange={(e) => setRemindDays(e.target.value)}
          />
          <div className="actions" style={{ marginTop: 0 }}>
            <button className="btn primary" type="submit" disabled={busy}>
              {editId ? "Сохранить" : "Добавить"}
            </button>
            {editId && (
              <button className="btn" type="button" onClick={clearForm}>
                Отмена
              </button>
            )}
          </div>
        </form>

        {!editId && (
          <>
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
          </>
        )}

        {report && (
          <p className="muted">
            Импорт: {report.imported}
            {report.encoding ? ` · ${report.encoding}` : ""}
            {report.errors.slice(0, 2).map((err) => (
              <span key={err} style={{ display: "block" }}>
                {err}
              </span>
            ))}
          </p>
        )}

        <input
          className="field"
          placeholder="Поиск…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="people-list">
          {people.map((p) => (
            <div key={p.id} className={`people-item ${editId === p.id ? "editing" : ""}`}>
              <button type="button" className="people-main" onClick={() => startEdit(p)}>
                <div className="row-title">{p.title}</div>
                <div className="row-meta">
                  {formatShortDate(p.month, p.day, p.year)}
                  {p.type === "holiday" ? " · праздник" : p.type === "custom" ? " · своё" : ""}
                  {p.remind_days != null ? ` · за ${p.remind_days} дн.` : ""}
                </div>
              </button>
              <div className="actions" style={{ marginTop: 0 }}>
                <button type="button" className="btn" title="Изменить" onClick={() => startEdit(p)}>
                  <IconEdit size={15} />
                </button>
                <button
                  type="button"
                  className="btn"
                  title="Фото"
                  onClick={async () => {
                    try {
                      const path = await pickAndStorePhoto(p.id);
                      if (path) {
                        await updateEvent(p.id, { photo_path: path });
                        await onChanged();
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  <IconCamera size={15} />
                </button>
                <button
                  type="button"
                  className="btn ghost-danger"
                  title="Удалить"
                  onClick={async () => {
                    if (editId === p.id) clearForm();
                    await deleteEvent(p.id);
                    await onChanged();
                  }}
                >
                  <IconTrash size={15} />
                </button>
              </div>
            </div>
          ))}
          {!people.length && <div className="empty">Пока пусто — добавьте или импортируйте</div>}
        </div>
      </div>
    </div>
  );
}
