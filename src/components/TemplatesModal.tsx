import { useState } from "react";
import type { Template } from "../templates/types";
import type { Locale, TranslationKey } from "../i18n/types";

type Props = {
  templates: Template[];
  /** True when the host has overlays worth saving — typically a PDF
   *  open with at least one item or a placed paraph. The Save input
   *  is disabled otherwise. */
  canSave: boolean;
  onSave: (name: string) => void;
  onApply: (template: Template) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onClose: () => void;
  t: (key: TranslationKey) => string;
  lang: Locale;
};

/**
 * Manage and apply saved templates. The modal hosts three actions :
 *  - Save the current document state under a user-chosen name.
 *  - Apply any saved template to the current PDF (overlays merge in).
 *  - Rename / delete an existing template.
 *
 * No PDF identification is involved — the user picks which template
 * they want, regardless of which PDF is open.
 */
export function TemplatesModal({ templates, canSave, onSave, onApply, onDelete, onRename, onClose, t, lang }: Props) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function handleSave() {
    const name = newName.trim();
    if (!name) return;
    onSave(name);
    setNewName("");
  }

  function startRename(template: Template) {
    setEditingId(template.id);
    setEditingName(template.name);
  }

  function commitRename(apply: boolean) {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (apply && trimmed) onRename(editingId, trimmed);
    setEditingId(null);
    setEditingName("");
  }

  // Most-recently-edited first.
  const sorted = [...templates].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card templates-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t("templates")}</h3>
          <button className="btn icon-btn" onClick={onClose} aria-label={t("signature_cancel")}>
            ×
          </button>
        </div>

        <div className="templates-save">
          <input
            type="text"
            value={newName}
            placeholder={t("templates_save_placeholder")}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            disabled={!canSave}
            title={canSave ? "" : t("templates_save_disabled")}
          />
          <button
            className="btn primary"
            onClick={handleSave}
            disabled={!canSave || !newName.trim()}
          >
            {t("templates_save_button")}
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="hint">{t("templates_empty")}</p>
        ) : (
          <ul className="templates-list">
            {sorted.map((template) => {
              const overlayCount = template.items.length + (template.paraph ? 1 : 0);
              return (
                <li key={template.id} className="templates-item">
                  {editingId === template.id ? (
                    <input
                      className="templates-rename"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => commitRename(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          commitRename(true);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          commitRename(false);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      className="templates-name"
                      onDoubleClick={() => startRename(template)}
                      title={t("templates_rename_hint")}
                    >
                      {template.name}
                    </button>
                  )}
                  <span className="templates-meta">
                    {new Date(template.updatedAt).toLocaleDateString(lang)} · {overlayCount}
                  </span>
                  <button
                    className="btn primary"
                    onClick={() => onApply(template)}
                  >
                    {t("templates_apply")}
                  </button>
                  <button
                    className="btn icon-btn"
                    onClick={() => onDelete(template.id)}
                    title={t("templates_delete")}
                    aria-label={t("templates_delete")}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
