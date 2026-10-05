import { getCurrentWindow } from "@tauri-apps/api/window";
import { IconClose, IconMinus, IconSettings, IconUserPlus } from "./Icons";

interface Props {
  onOpenSettings: () => void;
  onOpenPeople: () => void;
}

export function TitleBar({ onOpenSettings, onOpenPeople }: Props) {
  async function minimize() {
    try {
      await getCurrentWindow().minimize();
    } catch {
      /* browser */
    }
  }

  async function hideToTray() {
    try {
      await getCurrentWindow().hide();
    } catch {
      window.close();
    }
  }

  async function startDrag(e: React.MouseEvent) {
    if (e.button !== 0) return;
    // Не стартуем drag с кнопок
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    try {
      await getCurrentWindow().startDragging();
    } catch {
      /* browser */
    }
  }

  return (
    <div className="titlebar">
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button type="button" className="win-btn" title="Настройки" onClick={onOpenSettings}>
          <IconSettings size={15} />
        </button>
        <button type="button" className="win-btn" title="События" onClick={onOpenPeople}>
          <IconUserPlus size={15} />
        </button>
      </div>

      <div className="titlebar-drag" onMouseDown={startDrag}>
        <div className="brand">DATES</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button type="button" className="win-btn" title="Свернуть" onClick={minimize}>
          <IconMinus size={15} />
        </button>
        <button type="button" className="win-btn close" title="В трей" onClick={hideToTray}>
          <IconClose size={14} />
        </button>
      </div>
    </div>
  );
}
