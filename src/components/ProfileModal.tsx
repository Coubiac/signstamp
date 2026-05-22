import { useState } from "react";
import type { Profile } from "../types";
import type { Locale, TranslationKey } from "../i18n/types";
import { getProfileLabel, inputTypeForProfileKey } from "../i18n/profileLabels";

type Props = {
  onClose: () => void;
  profile: Profile;
  /** Canonical keys cannot be removed from the profile (they get added
   *  back on next launch via `mergeWithCanonical`). The modal hides
   *  the delete button on these entries to avoid the dead-click. */
  canonicalKeys: Set<string>;
  onChangeValue: (key: string, value: string) => void;
  onRemoveEntry: (key: string) => void;
  onAddKey: (key: string) => void;
  t: (key: TranslationKey) => string;
  lang: Locale;
};

/**
 * Editor for the persisted user profile. Lives in a modal so it does
 * not take up sidebar space during normal PDF editing — invoked from
 * the native menu (File → Profile…) or its keyboard shortcut.
 */
export function ProfileModal({ onClose, profile, canonicalKeys, onChangeValue, onRemoveEntry, onAddKey, t, lang }: Props) {
  const [newKeyInput, setNewKeyInput] = useState("");

  function submitNewKey() {
    const key = newKeyInput.trim();
    if (!key) return;
    onAddKey(key);
    setNewKeyInput("");
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t("profile")}</h3>
          <button className="btn icon-btn" onClick={onClose} aria-label={t("signature_cancel")}>
            ×
          </button>
        </div>
        <p className="hint">{t("profile_hint")}</p>

        <div className="profile-list">
          {profile.map((entry) => {
            const isCanonical = canonicalKeys.has(entry.key);
            return (
              <div key={entry.key} className="profile-item">
                <label className="profile-label">
                  {getProfileLabel(entry.key, lang)}
                </label>
                <input
                  type={inputTypeForProfileKey(entry.key)}
                  className="profile-value"
                  value={entry.value}
                  onChange={(e) => onChangeValue(entry.key, e.target.value)}
                />
                {!isCanonical && (
                  <button
                    className="profile-remove"
                    onClick={() => onRemoveEntry(entry.key)}
                    title={t("remove_profile_entry")}
                    aria-label={t("remove_profile_entry")}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="profile-add">
          <input
            type="text"
            value={newKeyInput}
            placeholder={t("profile_add_key_placeholder")}
            onChange={(e) => setNewKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitNewKey();
              }
            }}
            autoFocus
          />
          <button className="btn" onClick={submitNewKey}>
            {t("profile_add_key")}
          </button>
        </div>
      </div>
    </div>
  );
}
