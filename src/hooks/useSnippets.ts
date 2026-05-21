import { useMemo } from "react";
import { usePersistentState } from "./usePersistentState";
import { dualAdapter } from "./storageAdapters";

const STORAGE_KEY = "signstamp.snippets";

/**
 * Persisted list of reusable text snippets. Stored as a Tauri-managed
 * file in the desktop app, with a localStorage fallback for the web
 * build. Malformed entries (anything other than a string) are dropped
 * silently on load to keep the in-memory list tidy.
 */
export function useSnippets() {
  // The adapter is recreated on every render but only the mount-time
  // reference matters (the load effect runs once). Memoize anyway to
  // keep the React DevTools tree clean.
  const adapter = useMemo(() => dualAdapter<unknown>({
    webKey: STORAGE_KEY,
    loadCommand: "load_snippets",
    saveCommand: "save_snippets",
    saveArgName: "snippets"
  }), []);

  return usePersistentState<string[], unknown>({
    adapter,
    defaultValue: [],
    hydrate: (raw) => Array.isArray(raw) ? raw.filter((entry) => typeof entry === "string") : [],
    label: "snippets"
  });
}
