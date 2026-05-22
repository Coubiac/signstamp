// Default zoom and bounds for the PDF viewer.
export const ZOOM = {
  default: 1.25,
  min: 0.5,
  max: 4,
  step: 0.1
} as const;

// Default screen-space size used when a tool drops a fresh item.
// Sizes are in CSS pixels at the current viewport scale; they are
// converted to PDF units via pxSizeToPdfSize before being stored.
export const TEXT_DEFAULTS = {
  widthPx: 220,
  heightPx: 28
} as const;

export const DATE_DEFAULTS = {
  widthPx: 160,
  heightPx: 26
} as const;

export const CHECK_DEFAULTS = {
  sizePx: 22,
  fontSize: 16
} as const;

export const SIGNATURE_DEFAULTS = {
  widthPx: 220,
  minHeightPx: 50
} as const;

// Lower bound (in PDF units) when resizing an item via the handle.
export const MIN_RESIZE_PDF = {
  width: 10,
  height: 10
} as const;

export const HIGHLIGHT_OPACITY = 0.35;

// Half the visual side of the .handle dot in CSS pixels — used
// to center the dot on (x, y) for line/arrow handles.
export const HANDLE_HALF_PX = 7;

export const HISTORY_LIMIT = 100;

// Debounce window for the Tauri "open-with" path : a same path
// emitted twice (event + take_pending_open_paths) is deduped.
export const PATH_REOPEN_DEBOUNCE_MS = 5000;

// Safety margin before revoking a generated PDF object URL after
// the user-triggered download has had time to start.
export const OBJECT_URL_REVOKE_MS = 10_000;

// Canonical profile keys shipped pre-populated (with empty values) so
// the user sees what they can fill at first launch. The order is the
// display order in the profile panel. User-added custom keys live
// beside these but are not part of the canonical set.
export const CANONICAL_PROFILE_KEYS = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "address",
  "city",
  "zip",
  "country",
  "dateOfBirth",
  "iban"
] as const;

// CSS font stacks for the three logical families exposed in the UI.
// Kept here so the DOM overlay and any future style consumer share
// the exact same fallback chain.
export const FONT_STACK = {
  sans: '"Space Grotesk", "Fira Sans", "Segoe UI", sans-serif',
  serif: '"Merriweather", Georgia, serif',
  mono: '"Fira Code", Consolas, monospace'
} as const satisfies Record<"sans" | "serif" | "mono", string>;
