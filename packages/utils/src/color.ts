/**
 * Whether text on this background should be dark (true) or white (false), by WCAG contrast:
 * whichever of white or near-black (#0a0a0b) has more contrast with it. null for a bad colour.
 */
export function prefersDarkText(hex: string): boolean | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255);
  return (lum + 0.05) / 0.0532 > 1.05 / (lum + 0.05);
}
