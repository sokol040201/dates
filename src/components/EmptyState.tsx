import type { ReactNode } from "react";

export interface EmptyAction {
  label: string;
  onClick: () => void;
}

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: EmptyAction;
  secondaryAction?: EmptyAction;
}

export function EmptyState({ icon, title, description, action, secondaryAction }: Props) {
  const clickable = !!action;

  return (
    <div
      className={`empty-state${clickable ? " clickable" : ""}`}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={action ? () => action.onClick() : undefined}
      onKeyDown={
        action
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                action.onClick();
              }
            }
          : undefined
      }
    >
      {icon ? (
        <div className="empty-state-icon" aria-hidden>
          {icon}
        </div>
      ) : null}
      <div className="empty-state-copy">
        <div className="empty-state-title">{title}</div>
        {description ? <p className="empty-state-desc">{description}</p> : null}
        {(action || secondaryAction) && (
          <div className="empty-state-links">
            {action ? <span className="empty-state-link">{action.label}</span> : null}
            {secondaryAction ? (
              <button
                type="button"
                className="empty-state-link ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  secondaryAction.onClick();
                }}
              >
                {secondaryAction.label}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
