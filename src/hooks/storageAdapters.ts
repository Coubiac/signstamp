import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * Pluggable persistence backend used by `usePersistentState`. Each
 * adapter knows how to read and write a single value; choosing the
 * right adapter is the call site's responsibility.
 *
 * `load()` returns `null` when no value has been persisted yet (first
 * launch). It throws on actual I/O errors so the caller can log them.
 */
export type StorageAdapter<Stored> = {
  load(): Promise<Stored | null>;
  save(value: Stored): Promise<void>;
};

type TauriAdapterOptions = {
  loadCommand: string;
  saveCommand: string;
  /** Named argument expected by the Tauri save command. */
  saveArgName: string;
};

/** Adapter backed by a pair of Tauri commands. */
export function tauriAdapter<Stored>(opts: TauriAdapterOptions): StorageAdapter<Stored> {
  return {
    async load() {
      const value = await invoke<Stored>(opts.loadCommand);
      return value ?? null;
    },
    async save(value) {
      await invoke(opts.saveCommand, { [opts.saveArgName]: value });
    }
  };
}

/** Adapter backed by the browser's localStorage, JSON-encoded. */
export function localStorageAdapter<Stored>(key: string): StorageAdapter<Stored> {
  return {
    async load() {
      // The Promise.resolve() yield lets the host useEffect's save
      // branch see `loaded.current === false` before we mutate state,
      // which prevents an empty default from being written back over
      // the persisted value on first mount.
      await Promise.resolve();
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as Stored;
    },
    async save(value) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  };
}

/**
 * Adapter that delegates to Tauri when running inside the desktop
 * shell and falls back to localStorage in a plain browser. Use this
 * for data that should survive across web sessions when the user
 * has not installed the desktop app.
 */
export function dualAdapter<Stored>(
  opts: TauriAdapterOptions & { webKey: string }
): StorageAdapter<Stored> {
  return isTauri()
    ? tauriAdapter<Stored>(opts)
    : localStorageAdapter<Stored>(opts.webKey);
}

/**
 * Adapter that no-ops outside Tauri — useful for payloads we do not
 * want to persist in the browser at all (e.g. signature byte blobs).
 */
export function tauriOnlyAdapter<Stored>(opts: TauriAdapterOptions): StorageAdapter<Stored> {
  if (!isTauri()) {
    return {
      async load() { return null; },
      async save() { /* no-op */ }
    };
  }
  return tauriAdapter<Stored>(opts);
}
