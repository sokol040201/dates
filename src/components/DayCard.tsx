import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { EventTag, UpcomingEvent } from "../types";
import { TAG_OPTIONS, tagLabel } from "../types";
import { deleteEvent, hideEvent, updateEvent } from "../lib/db";
import { anniversaryLabel, formatShortDate, relativeLabel } from "../lib/dates";
import { buildGreeting, copyText, greetingTemplates } from "../lib/greetings";
import { photoSrc, pickAndStorePhoto, pickSoundFile } from "../lib/media";
import { IconCamera, IconClose, IconCopy, IconHide, IconLink, IconSound, IconTrash } from "./Icons";
import { Select } from "./ui";

interface Props {
  item: UpcomingEvent;
  defaultRemindDays: number;
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function DayCard({ item, defaultRemindDays, onClose, onChanged }: Props) {
  const e = item.event;
  const [notes, setNotes] = useState(e.notes ?? "");
  const [link, setLink] = useState(e.link ?? "");
  const [remind, setRemind] = useState(e.remind_days != null ? String(e.remind_days) : "");
  const [tag, setTag] = useState<EventTag>((e.tag as EventTag) || "");
  const [photo, setPhoto] = useState(e.photo_path);
  const [sound, setSound] = useState(e.sound_path);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const src = photoSrc(photo);
  const templates = greetingTemplates(e, item.age);
  const canEdit = e.source === "user";

  async function savePatch(patch: Parameters<typeof updateEvent>[1]) {
    setBusy(true);
    try {
      await updateEvent(e.id, patch);
      await onChanged();
      setStatus("Сохранено");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay">
      <div className="overlay-head">
        <strong>Карточка</strong>
        <button type="button" className="win-btn" onClick={onClose} title="Закрыть">
          <IconClose size={15} />
        </button>
      </div>

      <div className="overlay-body stack">
        <div className="daycard-hero">
          {src ? <img className="avatar lg" src={src} alt="" /> : <div className="avatar lg placeholder" />}
          <div>
            <div className="daycard-title">{e.title}</div>
            <div className="muted">
              {relativeLabel(item.daysUntil)} · {formatShortDate(e.month, e.day, e.year)}
              {anniversaryLabel(item.age) ? ` · ${anniversaryLabel(item.age)}` : ""}
              {tag ? ` · ${tagLabel(tag)}` : ""}
            </div>
          </div>
        </div>

        {canEdit && (
          <>
            <textarea
              className="field"
              style={{ minHeight: 56, resize: "vertical" }}
              placeholder="Заметка"
              value={notes}
              onChange={(ev) => setNotes(ev.target.value)}
              onBlur={() => {
                if (notes !== (e.notes ?? "")) void savePatch({ notes: notes || null });
              }}
            />
            <input
              className="field"
              placeholder="Ссылка"
              value={link}
              onChange={(ev) => setLink(ev.target.value)}
              onBlur={() => {
                if (link !== (e.link ?? "")) void savePatch({ link: link || null });
              }}
            />
            <div className="row-setting">
              <span className="row-setting-label">Напомнить за дней</span>
              <input
                className="field"
                style={{ width: 72, textAlign: "center" }}
                placeholder={String(defaultRemindDays)}
                value={remind}
                onChange={(ev) => setRemind(ev.target.value)}
                onBlur={() => {
                  const v = remind.trim() === "" ? null : Math.max(0, Number(remind) || 0);
                  void savePatch({ remind_days: v });
                }}
              />
            </div>
            <Select
              label="Метка"
              value={tag}
              onChange={(v) => {
                setTag(v);
                void savePatch({ tag: v || null });
              }}
              options={TAG_OPTIONS}
            />
            <div className="actions">
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={async () => {
                  try {
                    const path = await pickAndStorePhoto(e.id);
                    if (path) {
                      setPhoto(path);
                      await savePatch({ photo_path: path });
                    }
                  } catch (err) {
                    setStatus(String(err));
                  }
                }}
              >
                <IconCamera size={15} /> Фото
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={async () => {
                  try {
                    const path = await pickSoundFile();
                    if (path) {
                      setSound(path);
                      await savePatch({ sound_path: path });
                    }
                  } catch (err) {
                    setStatus(String(err));
                  }
                }}
              >
                <IconSound size={15} /> Звук
              </button>
              {sound && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSound(null);
                    void savePatch({ sound_path: null });
                  }}
                >
                  Сбросить звук
                </button>
              )}
            </div>
          </>
        )}

        {!canEdit && e.notes && <p className="muted">{e.notes}</p>}

        {link || e.link ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              const url = link || e.link;
              if (url) void openUrl(url);
            }}
          >
            <IconLink size={15} /> Ссылка
          </button>
        ) : null}

        <div className="setting-group-title">Поздравление</div>
        <div className="actions">
          <button
            type="button"
            className="btn primary"
            onClick={async () => {
              const ok = await copyText(buildGreeting(item));
              setStatus(ok ? "Скопировано" : "Не удалось скопировать");
            }}
          >
            <IconCopy size={15} /> Скопировать
          </button>
        </div>
        <div className="template-list">
          {templates.map((t) => (
            <button
              key={t}
              type="button"
              className="template-item"
              onClick={async () => {
                const ok = await copyText(t);
                setStatus(ok ? "Скопировано" : "Не удалось скопировать");
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="actions">
          {e.source !== "user" || e.type === "holiday" ? (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={async () => {
                await hideEvent(e.id, true);
                await onChanged();
                onClose();
              }}
            >
              <IconHide size={15} /> Скрыть
            </button>
          ) : null}
          {canEdit && (
            <button
              type="button"
              className="btn ghost-danger"
              disabled={busy}
              onClick={async () => {
                await deleteEvent(e.id);
                await onChanged();
                onClose();
              }}
            >
              <IconTrash size={15} /> Удалить
            </button>
          )}
        </div>

        {status && <p className="muted">{status}</p>}
      </div>
    </div>
  );
}
