/**
 * 8-bit RGB channels (0..255). Alpha is handled separately by the
 * site that consumes the channels (rgba string, pdf-lib opacity, ...).
 */
export type RgbChannels = {
  r: number;
  g: number;
  b: number;
};

/**
 * Parse a CSS 6-digit hex color (with or without a leading '#') into
 * 8-bit RGB channels. Returns `null` on malformed input so callers
 * can pick a context-appropriate fallback (black for the PDF export,
 * highlight yellow for the DOM overlay, etc.).
 *
 * Short 3-digit hex (#fff) is intentionally rejected — the rest of
 * the app only ever produces 6-digit values.
 */
export function parseHexColor(hex: string): RgbChannels | null {
  const value = hex.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

/** Format 8-bit channels and an alpha (0..1) as a CSS `rgba()` string. */
export function toCssRgba(channels: RgbChannels, alpha: number): string {
  return `rgba(${channels.r}, ${channels.g}, ${channels.b}, ${alpha})`;
}
