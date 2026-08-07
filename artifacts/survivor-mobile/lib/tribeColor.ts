// Helpers for show-tribe colors (mirrors the web app's tribeColor helpers).

/** Black or white text, whichever has the higher WCAG contrast ratio on the given hex background. */
export function tribeTextColor(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const lum =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  const contrastWithWhite = 1.05 / (lum + 0.05);
  const contrastWithBlack = (lum + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#1c1917";
}
