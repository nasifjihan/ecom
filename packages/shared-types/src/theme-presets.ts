/**
 * Ready-made storefront themes (Online store > Theme): colours, page and card tones and corner
 * roundness, each in a light and a dark version. The shop's own main and second colours, when it
 * changes them, replace the theme's.
 */
export interface ThemeTones {
  background: string;
  card: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
}

export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  /** The main and second colours on dark backgrounds. */
  darkPrimary: string;
  darkSecondary: string;
  /** CSS length for corners. */
  radius: string;
  light: ThemeTones;
  dark: ThemeTones;
}

export const THEME_PRESETS = [
  {
    // The look every store had before themes: kept so nothing changes until the shop picks another.
    id: "classic",
    name: "Classic",
    primary: "#7c3aed",
    secondary: "#f59e0b",
    darkPrimary: "#a78bfa",
    darkSecondary: "#fbbf24",
    radius: "0.625rem",
    light: { background: "#ffffff", card: "#ffffff", foreground: "#09090b", muted: "#f4f4f5", mutedForeground: "#71717a", border: "#e4e4e7" },
    dark: { background: "#09090b", card: "#111114", foreground: "#fafafa", muted: "#27272a", mutedForeground: "#a1a1aa", border: "#27272a" },
  },
  {
    id: "elegant",
    name: "Elegant",
    primary: "#1f2937",
    secondary: "#b08d57",
    darkPrimary: "#d4b483",
    darkSecondary: "#e7d3b0",
    radius: "0.25rem",
    light: { background: "#faf8f5", card: "#ffffff", foreground: "#1c1917", muted: "#f1ede6", mutedForeground: "#78716c", border: "#e7e0d6" },
    dark: { background: "#12100e", card: "#1c1916", foreground: "#f5f0e8", muted: "#26221d", mutedForeground: "#a8a29e", border: "#2e2923" },
  },
  {
    id: "fresh",
    name: "Fresh",
    primary: "#0f766e",
    secondary: "#fb7185",
    darkPrimary: "#2dd4bf",
    darkSecondary: "#fda4af",
    radius: "0.75rem",
    light: { background: "#ffffff", card: "#ffffff", foreground: "#0f172a", muted: "#f0fdfa", mutedForeground: "#5b6b6a", border: "#d5ece8" },
    dark: { background: "#071513", card: "#0d1f1c", foreground: "#ecfdf5", muted: "#12302b", mutedForeground: "#94b8b2", border: "#1c3a35" },
  },
  {
    id: "bold",
    name: "Bold",
    primary: "#dc2626",
    secondary: "#111827",
    darkPrimary: "#f87171",
    darkSecondary: "#f5f5f5",
    radius: "0.375rem",
    light: { background: "#ffffff", card: "#ffffff", foreground: "#111111", muted: "#f5f5f5", mutedForeground: "#666666", border: "#e5e5e5" },
    dark: { background: "#0a0a0a", card: "#151515", foreground: "#fafafa", muted: "#222222", mutedForeground: "#a3a3a3", border: "#2a2a2a" },
  },
  {
    id: "earthy",
    name: "Earthy",
    primary: "#92400e",
    secondary: "#65a30d",
    darkPrimary: "#f59e0b",
    darkSecondary: "#a3e635",
    radius: "0.5rem",
    light: { background: "#fdfaf5", card: "#ffffff", foreground: "#292524", muted: "#f5efe4", mutedForeground: "#78716c", border: "#eadfcf" },
    dark: { background: "#14110d", card: "#1e1a14", foreground: "#f5efe4", muted: "#2a241c", mutedForeground: "#a8a29e", border: "#352d22" },
  },
  {
    id: "minimal",
    name: "Minimal",
    primary: "#111827",
    secondary: "#6b7280",
    darkPrimary: "#f3f4f6",
    darkSecondary: "#9ca3af",
    radius: "0rem",
    light: { background: "#ffffff", card: "#ffffff", foreground: "#111827", muted: "#f3f4f6", mutedForeground: "#6b7280", border: "#e5e7eb" },
    dark: { background: "#0b0c0f", card: "#121418", foreground: "#f3f4f6", muted: "#1d2026", mutedForeground: "#9ca3af", border: "#262a31" },
  },
  {
    id: "royal",
    name: "Royal",
    primary: "#1e3a8a",
    secondary: "#ca8a04",
    darkPrimary: "#60a5fa",
    darkSecondary: "#facc15",
    radius: "0.625rem",
    light: { background: "#f8faff", card: "#ffffff", foreground: "#0f172a", muted: "#eef2fb", mutedForeground: "#64748b", border: "#dbe3f4" },
    dark: { background: "#070b18", card: "#0e1426", foreground: "#eef2ff", muted: "#18213a", mutedForeground: "#94a3b8", border: "#222c48" },
  },
  {
    id: "festive",
    name: "Festive",
    primary: "#be123c",
    secondary: "#eab308",
    darkPrimary: "#fb7185",
    darkSecondary: "#fde047",
    radius: "1rem",
    light: { background: "#fffaf5", card: "#ffffff", foreground: "#1f1315", muted: "#fdf0e8", mutedForeground: "#7c6a6d", border: "#f3dfd3" },
    dark: { background: "#140a0c", card: "#1f1013", foreground: "#fdf0e8", muted: "#2c171b", mutedForeground: "#b39ea2", border: "#3a2025" },
  },
] as const satisfies readonly ThemePreset[];

export type ThemePresetId = (typeof THEME_PRESETS)[number]["id"];
export const THEME_PRESET_IDS = THEME_PRESETS.map((p) => p.id) as [ThemePresetId, ...ThemePresetId[]];
export const themePreset = (id: string | undefined): ThemePreset => THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];

/** light / dark: always; auto: follows the shopper's phone or computer setting. */
export const THEME_MODES = ["light", "dark", "auto"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];
