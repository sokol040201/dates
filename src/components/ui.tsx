import { useEffect, useRef, useState } from "react";
import { IconChevron } from "./Icons";

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="row-setting">
      <span className="row-setting-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch ${checked ? "on" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className="switch-knob" />
      </button>
    </label>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="select-wrap" ref={ref}>
      {label && <div className="select-label">{label}</div>}
      <button type="button" className={`select-btn ${open ? "open" : ""}`} onClick={() => setOpen((v) => !v)}>
        <span>{current}</span>
        <IconChevron size={14} />
      </button>
      {open && (
        <div className="select-menu">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`select-item ${o.value === value ? "active" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="setting-group">
      <h3 className="setting-group-title">{title}</h3>
      <div className="setting-group-body">{children}</div>
    </section>
  );
}
