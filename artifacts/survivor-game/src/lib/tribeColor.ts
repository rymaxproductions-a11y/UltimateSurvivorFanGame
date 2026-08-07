// Shared helpers for show-tribe colors.

/** Preset palette offered in the admin UI (classic buff colors). */
export const TRIBE_COLOR_PRESETS = [
  "#dc2626", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#16a34a", // green
  "#0d9488", // teal
  "#2563eb", // blue
  "#7c3aed", // purple
  "#db2777", // pink
  "#78716c", // stone
  "#0f172a", // navy
] as const;

/** Black or white text, whichever has the higher WCAG contrast ratio on the given hex background. */
export function tribeTextColor(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  // WCAG relative luminance
  const lum =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  const contrastWithWhite = 1.05 / (lum + 0.05);
  const contrastWithBlack = (lum + 0.05) / 0.05;
  return contrastWithWhite >= contrastWithBlack ? "#ffffff" : "#1c1917";
}

/** Inline styles for a tribe badge; falls back to undefined when no color set. */
export function tribeBadgeStyle(color: string | null | undefined):
  | { backgroundColor: string; color: string }
  | undefined {
  if (!color) return undefined;
  return { backgroundColor: color, color: tribeTextColor(color) };
}
