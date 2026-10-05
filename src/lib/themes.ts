export interface AccentTheme {
  id: string;
  label: string;
  /** Светлая тема */
  accent: string;
  /** Тёмная тема */
  accentDark: string;
  today: string;
  todayDark: string;
}

/** Готовые акцентные палитры */
export const ACCENT_THEMES: AccentTheme[] = [
  {
    id: "sage",
    label: "Шалфей",
    accent: "#2f6f6a",
    accentDark: "#8fd4cc",
    today: "#1b8a4a",
    todayDark: "#7de89a",
  },
  {
    id: "ocean",
    label: "Океан",
    accent: "#2f5f8a",
    accentDark: "#8eb8e8",
    today: "#1a7a8a",
    todayDark: "#6ed0e0",
  },
  {
    id: "indigo",
    label: "Индиго",
    accent: "#4a4f8c",
    accentDark: "#b0b4ef",
    today: "#3d5a9e",
    todayDark: "#9db4ff",
  },
  {
    id: "plum",
    label: "Слива",
    accent: "#6b4a7a",
    accentDark: "#d4a8e0",
    today: "#8a4a7a",
    todayDark: "#e8a0d0",
  },
  {
    id: "rose",
    label: "Роза",
    accent: "#9a4a5c",
    accentDark: "#f0a8b8",
    today: "#b04555",
    todayDark: "#ffb0bc",
  },
  {
    id: "amber",
    label: "Янтарь",
    accent: "#9a6b2f",
    accentDark: "#e8c080",
    today: "#b07a28",
    todayDark: "#f0d090",
  },
  {
    id: "slate",
    label: "Сланец",
    accent: "#4a5560",
    accentDark: "#b8c4d0",
    today: "#3d6b5a",
    todayDark: "#8fd4b8",
  },
  {
    id: "forest",
    label: "Лес",
    accent: "#3d6b3a",
    accentDark: "#9ed49a",
    today: "#2d8a3a",
    todayDark: "#8aee90",
  },
];

export const DEFAULT_ACCENT = "sage";

export function resolveAccent(accentId: string | null | undefined): AccentTheme {
  const id = accentId || DEFAULT_ACCENT;
  if (id.startsWith("#") && /^#[0-9a-fA-F]{6}$/.test(id)) {
    return {
      id: "custom",
      label: "Свой",
      accent: id,
      accentDark: lightenHex(id, 0.35),
      today: id,
      todayDark: lightenHex(id, 0.4),
    };
  }
  return ACCENT_THEMES.find((t) => t.id === id) ?? ACCENT_THEMES[0];
}

export function applyAccentTheme(accentId: string | null | undefined, theme: "light" | "dark") {
  const resolved = resolveAccent(accentId);
  const root = document.documentElement;
  const isDark = theme === "dark";
  root.dataset.accent = resolved.id === "custom" ? "custom" : resolved.id;
  root.style.setProperty("--accent", isDark ? resolved.accentDark : resolved.accent);
  root.style.setProperty("--today", isDark ? resolved.todayDark : resolved.today);
}

function lightenHex(hex: string, amount: number): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
