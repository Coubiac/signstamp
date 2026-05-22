import { useMemo } from "react";
import type { Profile, ProfileEntry } from "../types";
import { CANONICAL_PROFILE_KEYS } from "../constants";
import { usePersistentState } from "./usePersistentState";
import { tauriOnlyAdapter } from "./storageAdapters";

const CANONICAL_KEY_SET: Set<string> = new Set(CANONICAL_PROFILE_KEYS);

function canonicalDefaults(): Profile {
  return CANONICAL_PROFILE_KEYS.map((key) => ({ key, value: "" }));
}

/**
 * Merge a persisted profile with the canonical key list so any
 * canonical key added in a newer version of the app shows up even
 * for users whose `profile.json` pre-dates it. Custom keys keep
 * their stored order after the canonical block. Exported so it can
 * be unit-tested ; the hook below is the only intended runtime caller.
 */
export function mergeWithCanonical(stored: ProfileEntry[]): Profile {
  const storedByKey = new Map(stored.map((e) => [e.key, e.value]));
  const canonical: Profile = CANONICAL_PROFILE_KEYS.map((key) => ({
    key,
    value: storedByKey.get(key) ?? ""
  }));
  const custom: Profile = stored.filter((e) => !CANONICAL_KEY_SET.has(e.key));
  return [...canonical, ...custom];
}

/**
 * Persisted user profile, available only inside the Tauri desktop
 * shell. Stores potentially sensitive PII (name, email, IBAN, …) so
 * we deliberately do not fall back to localStorage in the web
 * preview — the empty default is preferable to leaking PII into the
 * browser's storage layer.
 */
export function useProfile() {
  const adapter = useMemo(
    () => tauriOnlyAdapter<ProfileEntry[]>({
      loadCommand: "load_profile",
      saveCommand: "save_profile",
      saveArgName: "profile"
    }),
    []
  );

  return usePersistentState<Profile, ProfileEntry[]>({
    adapter,
    defaultValue: canonicalDefaults(),
    hydrate: (stored) => mergeWithCanonical(stored),
    label: "profile"
  });
}
