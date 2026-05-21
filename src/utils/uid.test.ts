import { afterEach, describe, expect, it, vi } from "vitest";
import { uid } from "./uid";

describe("uid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a non-empty string", () => {
    expect(uid()).toMatch(/.+/);
  });

  it("produces different values on successive calls", () => {
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
  });

  it("delegates to crypto.randomUUID when available", () => {
    const spy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(uid()).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("falls back to a timestamp mash when randomUUID is missing", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(undefined as never);
    const result = uid();
    // Only chars allowed by the fallback regex.
    expect(result).toMatch(/^[a-z0-9-]+$/i);
    // The decimal separator from `Date.now() + Math.random()` must be stripped.
    expect(result).not.toContain(".");
  });
});
