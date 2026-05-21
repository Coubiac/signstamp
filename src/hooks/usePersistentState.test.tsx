import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { usePersistentState, type UsePersistentStateOptions } from "./usePersistentState";
import type { StorageAdapter } from "./storageAdapters";

/**
 * Tiny harness that exposes the hook's value via the DOM and its
 * setter via a ref handle, so tests can drive the hook with `act()`.
 */
function makeHarness<T, Stored = T>(options: UsePersistentStateOptions<T, Stored>) {
  let latestSetter: ((updater: T | ((prev: T) => T)) => void) | null = null;
  function Probe() {
    const [value, setValue] = usePersistentState(options);
    latestSetter = setValue;
    return <div data-testid="value">{JSON.stringify(value)}</div>;
  }
  const utils = render(<Probe />);
  return {
    ...utils,
    setValue: (updater: T | ((prev: T) => T)) => act(() => latestSetter!(updater)),
    read: () => JSON.parse(utils.getByTestId("value").textContent ?? "null") as T
  };
}

/**
 * Build a deferred-load adapter so tests can observe what happens
 * while the load promise is pending vs. after it has resolved.
 */
function makeAdapter<S>(initial: S | null = null) {
  let stored: S | null = initial;
  let resolveLoad: ((value: S | null) => void) | null = null;
  let saveCount = 0;
  const saveCalls: S[] = [];

  const adapter: StorageAdapter<S> = {
    load: () => new Promise((resolve) => {
      resolveLoad = resolve;
    }),
    save: async (value) => {
      saveCount += 1;
      saveCalls.push(value);
      stored = value;
    }
  };

  return {
    adapter,
    resolveLoadWith: (value: S | null) => resolveLoad!(value),
    get saveCount() { return saveCount; },
    get saveCalls() { return saveCalls; },
    get stored() { return stored; }
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("usePersistentState", () => {
  it("starts at defaultValue and reflects the loaded value when the adapter resolves", async () => {
    const a = makeAdapter<string[]>();
    const h = makeHarness({ adapter: a.adapter, defaultValue: [] as string[] });
    expect(h.read()).toEqual([]);

    await act(async () => { a.resolveLoadWith(["one", "two"]); });
    await waitFor(() => expect(h.read()).toEqual(["one", "two"]));
  });

  it("falls back to defaultValue when load resolves to null", async () => {
    const a = makeAdapter<string[]>();
    const h = makeHarness({ adapter: a.adapter, defaultValue: ["seed"] });
    await act(async () => { a.resolveLoadWith(null); });
    await waitFor(() => expect(h.read()).toEqual(["seed"]));
  });

  it("does NOT save the default value while the initial load is pending", async () => {
    const a = makeAdapter<string[]>();
    makeHarness({ adapter: a.adapter, defaultValue: [] as string[] });
    // Save effect should have been skipped because hasLoaded.current is still false.
    await new Promise(r => setTimeout(r, 0));
    expect(a.saveCount).toBe(0);
  });

  it("saves on subsequent state changes once the load has completed", async () => {
    const a = makeAdapter<string[]>();
    const h = makeHarness({ adapter: a.adapter, defaultValue: [] as string[] });
    await act(async () => { a.resolveLoadWith([]); });
    // First save after load = the loaded value being written back (idempotent).
    await waitFor(() => expect(a.saveCount).toBe(1));

    h.setValue(["new"]);
    await waitFor(() => expect(a.saveCount).toBe(2));
    expect(a.saveCalls[1]).toEqual(["new"]);
  });

  it("applies hydrate to the loaded value", async () => {
    type Stored = { items: string[] };
    type Live = string[];
    const a = makeAdapter<Stored>();
    const h = makeHarness<Live, Stored>({
      adapter: a.adapter,
      defaultValue: [],
      hydrate: (s) => s.items.map((v) => v.toUpperCase())
    });
    await act(async () => { a.resolveLoadWith({ items: ["a", "b"] }); });
    await waitFor(() => expect(h.read()).toEqual(["A", "B"]));
  });

  it("applies dehydrate before saving", async () => {
    type Stored = { items: string[] };
    type Live = string[];
    const a = makeAdapter<Stored>();
    const h = makeHarness<Live, Stored>({
      adapter: a.adapter,
      defaultValue: [],
      hydrate: (s) => s.items,
      dehydrate: (v) => ({ items: v })
    });
    await act(async () => { a.resolveLoadWith({ items: [] }); });
    await waitFor(() => expect(a.saveCount).toBe(1));

    h.setValue(["x"]);
    await waitFor(() => expect(a.saveCalls[1]).toEqual({ items: ["x"] }));
  });

  it("calls onLoaded exactly once after the first load completes", async () => {
    const onLoaded = vi.fn();
    const a = makeAdapter<string[]>();
    const h = makeHarness({ adapter: a.adapter, defaultValue: [] as string[], onLoaded });
    await act(async () => { a.resolveLoadWith(["x"]); });
    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
    expect(onLoaded).toHaveBeenCalledWith(["x"]);

    h.setValue(["y"]);
    // Updating state after the load must not re-trigger onLoaded.
    await waitFor(() => expect(a.saveCount).toBeGreaterThan(1));
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it("logs and falls back to defaultValue when load throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const adapter: StorageAdapter<string[]> = {
      load: async () => { throw new Error("boom"); },
      save: vi.fn()
    };
    const h = makeHarness({ adapter, defaultValue: ["fallback"], label: "test" });
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(h.read()).toEqual(["fallback"]);
  });

  it("does not call onLoaded after unmount", async () => {
    const onLoaded = vi.fn();
    const a = makeAdapter<string[]>();
    const h = makeHarness({ adapter: a.adapter, defaultValue: [] as string[], onLoaded });
    h.unmount();
    await act(async () => { a.resolveLoadWith(["late"]); });
    expect(onLoaded).not.toHaveBeenCalled();
  });
});
