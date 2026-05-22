import { describe, expect, it } from "vitest";
import { mergeWithCanonical } from "./useProfile";
import { CANONICAL_PROFILE_KEYS } from "../constants";

describe("mergeWithCanonical", () => {
  it("returns the full canonical set with empty values on first launch", () => {
    const merged = mergeWithCanonical([]);
    expect(merged.map((e) => e.key)).toEqual([...CANONICAL_PROFILE_KEYS]);
    expect(merged.every((e) => e.value === "")).toBe(true);
  });

  it("preserves stored values for canonical keys", () => {
    const merged = mergeWithCanonical([
      { key: "email", value: "jane@example.com" },
      { key: "firstName", value: "Jane" }
    ]);
    expect(merged.find((e) => e.key === "email")?.value).toBe("jane@example.com");
    expect(merged.find((e) => e.key === "firstName")?.value).toBe("Jane");
    // Untouched canonical keys keep their empty default.
    expect(merged.find((e) => e.key === "lastName")?.value).toBe("");
  });

  it("backfills canonical keys missing from the persisted profile", () => {
    // Simulates a profile.json written by a previous version that knew
    // only firstName + email — the new canonical keys must appear.
    const merged = mergeWithCanonical([
      { key: "firstName", value: "Jane" },
      { key: "email", value: "jane@example.com" }
    ]);
    expect(merged.map((e) => e.key)).toEqual([...CANONICAL_PROFILE_KEYS]);
  });

  it("appends custom user-added keys after the canonical block", () => {
    const merged = mergeWithCanonical([
      { key: "firstName", value: "Jane" },
      { key: "nickname", value: "JD" },
      { key: "twitter", value: "@jane" }
    ]);
    const customStartsAt = CANONICAL_PROFILE_KEYS.length;
    expect(merged).toHaveLength(CANONICAL_PROFILE_KEYS.length + 2);
    expect(merged[customStartsAt]).toEqual({ key: "nickname", value: "JD" });
    expect(merged[customStartsAt + 1]).toEqual({ key: "twitter", value: "@jane" });
  });

  it("keeps canonical order regardless of the persisted order", () => {
    const merged = mergeWithCanonical([
      // Persisted in reverse — canonical block must still come back ordered.
      { key: "country", value: "FR" },
      { key: "firstName", value: "Jane" }
    ]);
    expect(merged.slice(0, CANONICAL_PROFILE_KEYS.length).map((e) => e.key))
      .toEqual([...CANONICAL_PROFILE_KEYS]);
  });
});
