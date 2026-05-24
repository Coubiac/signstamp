import { useMemo } from "react";
import type { Template } from "../templates/types";
import { usePersistentState } from "./usePersistentState";
import { tauriOnlyAdapter } from "./storageAdapters";

/**
 * Persisted list of saved templates, available only inside the Tauri
 * desktop shell. Templates can be substantial (every overlay item is
 * persisted), so localStorage is not used as a fallback ; the web
 * preview gets an empty list.
 *
 * The Rust side stores each template as an opaque JSON value, so the
 * frontend remains the single source of truth for the schema —
 * adding a new item type or field requires no Tauri change.
 */
export function useTemplates() {
  const adapter = useMemo(
    () => tauriOnlyAdapter<Template[]>({
      loadCommand: "load_templates",
      saveCommand: "save_templates",
      saveArgName: "templates"
    }),
    []
  );

  return usePersistentState<Template[]>({
    adapter,
    defaultValue: [],
    label: "templates"
  });
}
