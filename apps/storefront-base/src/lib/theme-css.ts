/**
 * The storefront's colours as CSS variables, from the theme picked in the admin: the ready-made
 * theme's tones in light and dark, with the shop's own main and second colours. Only numbers
 * come out (hex is parsed), so the result is safe inside a <style> tag.
 */
import { prefersDarkText } from "@ecom/utils";
import { themePreset, type ThemeTones } from "@ecom/shared-types";

const HEX = /^#?([0-9a-f]{6})$/i;

/** "#7c3aed" → [262, 83, 58] (hue, saturation %, lightness %), or null for anything else. */
export function hexToHsl(hex: string): [number, number, number] | null {
  const m = HEX.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

const hsl = (v: [number, number, number]) => `${v[0]} ${v[1]}% ${v[2]}%`;
const varOf = (hex: string) => {
  const v = hexToHsl(hex);
  return v ? hsl(v) : null;
};
/** Text that reads on this colour: near-black or white. */
const onColour = (hex: string) => (prefersDarkText(hex) ? "240 10% 3.9%" : "0 0% 100%");
/** A shop's own colour on a dark background: lighter, so it still stands out. */
const forDark = (hex: string) => {
  const v = hexToHsl(hex);
  return v ? hsl([v[0], v[1], Math.min(75, Math.max(60, v[2]))]) : null;
};

function tones(t: ThemeTones): string[] {
  const fg = varOf(t.foreground);
  return [
    ["background", varOf(t.background)],
    ["foreground", fg],
    ["card", varOf(t.card)],
    ["card-foreground", fg],
    ["popover", varOf(t.card)],
    ["popover-foreground", fg],
    ["muted", varOf(t.muted)],
    ["muted-foreground", varOf(t.mutedForeground)],
    ["accent", varOf(t.muted)],
    ["accent-foreground", fg],
    ["border", varOf(t.border)],
    ["input", varOf(t.border)],
  ].map(([k, v]) => `--${k}:${v}`);
}

export interface ThemeColours {
  colors: { primary: string; secondary?: string };
  appearance?: { preset: string };
}

export function themeCss(theme: ThemeColours): string {
  const p = themePreset(theme.appearance?.preset);
  const primary = HEX.test(theme.colors.primary) ? theme.colors.primary : p.primary;
  const secondary = theme.colors.secondary && HEX.test(theme.colors.secondary) ? theme.colors.secondary : p.secondary;
  // The theme's own dark colours unless the shop chose different ones.
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const darkPrimary = same(primary, p.primary) ? varOf(p.darkPrimary) : forDark(primary);
  const darkSecondary = same(secondary, p.secondary) ? varOf(p.darkSecondary) : forDark(secondary);
  const darkPrimaryHex = same(primary, p.primary) ? p.darkPrimary : primary;
  const light = [
    ...tones(p.light),
    `--primary:${varOf(primary)}`,
    `--primary-foreground:${onColour(primary)}`,
    `--ring:${varOf(primary)}`,
    `--secondary:${varOf(secondary)}`,
    `--secondary-foreground:${onColour(secondary)}`,
    `--radius:${p.radius}`,
    "color-scheme:light",
  ];
  const dark = [
    ...tones(p.dark),
    `--primary:${darkPrimary}`,
    // Lightened colours carry dark text.
    `--primary-foreground:${same(primary, p.primary) ? onColour(darkPrimaryHex) : "240 10% 3.9%"}`,
    `--ring:${darkPrimary}`,
    `--secondary:${darkSecondary}`,
    "--secondary-foreground:240 10% 3.9%",
    "color-scheme:dark",
  ];
  return `:root{${light.join(";")}}:root.dark{${dark.join(";")}}`;
}

/** The cookie that keeps a shopper's light / dark choice (when the shop shows the switch). */
export const MODE_COOKIE = "sf_mode";

/**
 * Runs before the page paints, so it opens in the right mode with no white flash. The mode
 * and whether to read the cookie are the only inputs, both from fixed values.
 */
export function modeScript(mode: "light" | "dark" | "auto", shopperSwitch: boolean): string {
  const m = mode === "dark" ? "dark" : mode === "auto" ? "auto" : "light";
  return `(function(){try{var c=${shopperSwitch ? `document.cookie.match(/(?:^|; )${MODE_COOKIE}=(light|dark)/)` : "null"};var d=c?c[1]==="dark":${m === "auto" ? `window.matchMedia("(prefers-color-scheme: dark)").matches` : m === "dark" ? "true" : "false"};document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
}
