import { describe, expect, it } from "vitest";
import { hexToHsl, modeScript, themeCss } from "../src/lib/theme-css";

describe("storefront theme colours", () => {
  it("turns hex into hue, saturation and lightness", () => {
    expect(hexToHsl("#7c3aed")).toEqual([262, 83, 58]);
    expect(hexToHsl("#ffffff")).toEqual([0, 0, 100]);
    expect(hexToHsl("red")).toBeNull();
  });

  it("writes light and dark variables for the picked theme", () => {
    const css = themeCss({ colors: { primary: "#1e3a8a", secondary: "#ca8a04" }, appearance: { preset: "royal" } });
    expect(css).toMatch(/^:root\{[^}]*--radius:0\.625rem[^}]*\}:root\.dark\{[^}]*color-scheme:dark\}$/);
    // Royal's own dark main colour (#60a5fa → 213 94% 68%).
    expect(css).toContain(":root.dark{--background:");
    expect(css).toMatch(/:root\.dark\{[^}]*--primary:213 94% 68%/);
  });

  it("keeps a shop's own colour, made lighter for dark mode", () => {
    const css = themeCss({ colors: { primary: "#14532d" }, appearance: { preset: "fresh" } });
    expect(css).toMatch(/:root\{[^}]*--primary:\d+ \d+% 20%/);
    expect(css).toMatch(/:root\.dark\{[^}]*--primary:\d+ \d+% 60%/);
  });

  it("falls back to Classic for an unknown theme, and never lets text through", () => {
    const css = themeCss({ colors: { primary: "</style><script>", secondary: "x" }, appearance: { preset: "nope" } });
    expect(css).not.toMatch(/<|script/);
    expect(css).toContain("--primary:262 83% 58%");
  });

  it("chooses the mode script from fixed values only", () => {
    expect(modeScript("dark", false)).toContain("var c=null;var d=c?c[1]===\"dark\":true");
    expect(modeScript("auto", true)).toContain("prefers-color-scheme: dark");
    expect(modeScript("light", true)).toContain("sf_mode=(light|dark)");
  });
});
