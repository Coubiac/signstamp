import type { Item, Paraph } from "../types";

/**
 * A saved overlay configuration. The user creates one by clicking
 * "Save as template" with the current document state ; later, they
 * pick the template from a list and apply it to **any** open PDF
 * (no PDF-identification heuristic — selection is fully manual).
 *
 * Items carry their stored values verbatim, except for those marked
 * `autoDate: true` whose value is recomputed at apply time.
 */
export type Template = {
  id: string;
  /** User-chosen, used as the display label. Not required to be unique. */
  name: string;
  /** ISO timestamp ; the modal sorts most-recent-first and shows it. */
  updatedAt: string;
  items: Item[];
  /** Persisted paraph configuration, or null if the user didn't have one. */
  paraph: Paraph | null;
};
