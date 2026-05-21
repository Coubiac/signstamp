/**
 * Generate a unique identifier suitable for React keys and item ids.
 *
 * Uses `crypto.randomUUID()` when available (modern browsers, Node 19+,
 * jsdom 20+). Falls back to a numeric mash of `Date.now()` and
 * `Math.random()` for legacy environments — the regex strips the
 * decimal point so the value remains a safe identifier.
 */
export function uid(): string {
  const native = globalThis.crypto?.randomUUID?.();
  if (native) return native;

  const seed = String(Date.now() + Math.random());
  return seed.replace(/[^a-z0-9-]/gi, "");
}
