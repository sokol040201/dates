import winterDecor from "../assets/skins/winter.png";
import springDecor from "../assets/skins/spring.png";
import summerDecor from "../assets/skins/summer.png";
import autumnDecor from "../assets/skins/autumn.png";

export type SkinId = "none" | "auto" | "winter" | "spring" | "summer" | "autumn";
export type ActiveSkin = "none" | "winter" | "spring" | "summer" | "autumn";

export interface SkinDef {
  id: ActiveSkin;
  label: string;
  /** Акцент светлой темы */
  accent: string;
  accentDark: string;
  today: string;
  todayDark: string;
  soon: string;
  soonDark: string;
  /** Лёгкий оттенок стекла (светлая) */
  glassTint: string;
  glassTintDark: string;
  decor: string | null;
}

export const SKINS: Record<Exclude<ActiveSkin, "none">, SkinDef> = {
  winter: {
    id: "winter",
    label: "Зима",
    accent: "#3a6ea5",
    accentDark: "#9ec8ff",
    today: "#2f7ab8",
    todayDark: "#8fd0ff",
    soon: "#4a7eb5",
    soonDark: "#a8d0ff",
    glassTint: "rgba(210, 228, 245, 0.55)",
    glassTintDark: "rgba(28, 42, 58, 0.72)",
    decor: winterDecor,
  },
  spring: {
    id: "spring",
    label: "Весна",
    accent: "#3d8a4a",
    accentDark: "#9ed49a",
    today: "#2d8a3a",
    todayDark: "#8aee90",
    soon: "#5a9a4a",
    soonDark: "#b0e8a8",
    glassTint: "rgba(232, 245, 228, 0.55)",
    glassTintDark: "rgba(28, 42, 32, 0.72)",
    decor: springDecor,
  },
  summer: {
    id: "summer",
    label: "Лето",
    accent: "#c49a2a",
    accentDark: "#f0d070",
    today: "#2f8ab8",
    todayDark: "#8fd0f0",
    soon: "#3a8ec0",
    soonDark: "#9ed8f5",
    glassTint: "rgba(255, 246, 220, 0.55)",
    glassTintDark: "rgba(42, 36, 22, 0.72)",
    decor: summerDecor,
  },
  autumn: {
    id: "autumn",
    label: "Осень",
    accent: "#c45a2a",
    accentDark: "#f0a878",
    today: "#d06a30",
    todayDark: "#ffb080",
    soon: "#c46a35",
    soonDark: "#f0b090",
    glassTint: "rgba(255, 232, 214, 0.55)",
    glassTintDark: "rgba(42, 28, 22, 0.72)",
    decor: autumnDecor,
  },
};

export const SKIN_OPTIONS: { id: SkinId; label: string }[] = [
  { id: "auto", label: "Авто (по сезону)" },
  { id: "none", label: "Без скина" },
  { id: "winter", label: "Зима" },
  { id: "spring", label: "Весна" },
  { id: "summer", label: "Лето" },
  { id: "autumn", label: "Осень" },
];

/** Месяц 1–12 → сезон */
export function seasonForMonth(month: number): Exclude<ActiveSkin, "none"> {
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

export function resolveSkin(skinId: string | null | undefined, date = new Date()): ActiveSkin {
  const id = (skinId || "auto") as SkinId;
  if (id === "none") return "none";
  if (id === "winter" || id === "spring" || id === "summer" || id === "autumn") return id;
  return seasonForMonth(date.getMonth() + 1);
}

export function getSkinDef(active: ActiveSkin): SkinDef | null {
  if (active === "none") return null;
  return SKINS[active];
}

/** Применить сезонный скин поверх базового акцента (скин имеет приоритет, если не none) */
export function applySkin(
  skinId: string | null | undefined,
  theme: "light" | "dark",
  /** если скин none — оставить текущий акцент как есть */
  fallbackAccentApply?: () => void,
) {
  const active = resolveSkin(skinId);
  const root = document.documentElement;
  root.dataset.skin = active;

  const def = getSkinDef(active);
  if (!def) {
    root.style.removeProperty("--skin-glass-tint");
    root.style.removeProperty("--soon");
    fallbackAccentApply?.();
    return;
  }

  const isDark = theme === "dark";
  root.style.setProperty("--accent", isDark ? def.accentDark : def.accent);
  root.style.setProperty("--today", isDark ? def.todayDark : def.today);
  root.style.setProperty("--soon", isDark ? def.soonDark : def.soon);
  root.style.setProperty("--skin-glass-tint", isDark ? def.glassTintDark : def.glassTint);
}
