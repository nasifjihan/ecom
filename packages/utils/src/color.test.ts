import { describe, expect, it } from "vitest";
import { prefersDarkText } from "./color";

describe("prefersDarkText", () => {
  it("puts white text on dark and saturated brand colours", () => {
    for (const c of ["#7c3aed", "#2563eb", "#0f172a", "#be123c", "#7f1d1d"]) expect(prefersDarkText(c)).toBe(false);
  });
  it("puts dark text on light, yellow and pastel colours", () => {
    for (const c of ["#ffffff", "#eab308", "#f5e6c8", "#84cc16", "#fde68a", "#ca8a04"]) expect(prefersDarkText(c)).toBe(true);
    // Emerald 600: white is only 3.8:1 (fails AA), dark text is 5.2:1.
    expect(prefersDarkText("#059669")).toBe(true);
  });
  it("refuses anything that isn't a 6-digit hex colour", () => {
    expect(prefersDarkText("red")).toBeNull();
    expect(prefersDarkText("#fff")).toBeNull();
  });
});
