import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { StorageAdapter } from "./storageAdapters";

export type UsePersistentStateOptions<T, Stored = T> = {
  /** Storage backend (Tauri, localStorage, dual, ...). */
  adapter: StorageAdapter<Stored>;
  /** Initial value used until the first load resolves. */
  defaultValue: T;
  /**
   * Transform the persisted form into the in-memory form. Async to
   * allow heavy decoding (e.g. signature bytes -> data URLs). When
   * absent the persisted form is assumed equal to the in-memory form.
   */
  hydrate?: (stored: Stored) => Promise<T> | T;
  /**
   * Transform the in-memory form into the persisted form. When absent
   * the value is written as-is.
   */
  dehydrate?: (value: T) => Stored;
  /**
   * Called once after the first load completes (success or empty),
   * with the resolved value. Useful for one-shot side effects such
   * as picking an initial selection.
   */
  onLoaded?: (value: T) => void;
  /** Tag used to prefix console errors so failures are attributable. */
  label?: string;
};

/**
 * React state hook backed by a `StorageAdapter`. Encapsulates the
 * "did the initial load complete?" dance so callers do not have to
 * manage a `didLoad` ref by hand: the save effect is silent until
 * the first load settles.
 *
 * Behaviour:
 *   - On mount: trigger `adapter.load()`. While that promise is
 *     pending, `setValue` is still functional but persistence is
 *     suspended (so an early user-driven update is not overwritten
 *     by the initial empty state being saved back).
 *   - When the load resolves, the loaded value (or `defaultValue`
 *     when the store was empty) replaces the in-memory state and
 *     `onLoaded` fires.
 *   - On every subsequent value change, `adapter.save()` is invoked
 *     with the dehydrated payload. Errors are logged, not thrown.
 */
export function usePersistentState<T, Stored = T>(
  options: UsePersistentStateOptions<T, Stored>
): [T, Dispatch<SetStateAction<T>>] {
  const { adapter, defaultValue, hydrate, dehydrate, onLoaded, label = "persistent state" } = options;

  const [value, setValue] = useState<T>(defaultValue);
  const hasLoaded = useRef(false);

  // Stash the callback so the load effect's [] dependency array does
  // not need to invalidate when the caller passes a fresh closure.
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let resolved: T = defaultValue;
      try {
        const stored = await adapter.load();
        if (cancelled) return;
        if (stored != null) {
          resolved = hydrate ? await hydrate(stored) : (stored as unknown as T);
        }
      } catch (err) {
        console.error(`Load ${label} failed:`, err);
      } finally {
        if (!cancelled) {
          setValue(resolved);
          onLoadedRef.current?.(resolved);
        }
        hasLoaded.current = true;
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // adapter / hydrate / defaultValue are captured intentionally on
    // mount only; the hook is not designed to swap backends at runtime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasLoaded.current) return;
    const payload = dehydrate ? dehydrate(value) : (value as unknown as Stored);
    adapter.save(payload).catch((err) => {
      console.error(`Save ${label} failed:`, err);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return [value, setValue];
}
