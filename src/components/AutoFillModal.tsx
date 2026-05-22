import type { TranslationKey } from "../i18n/types";
import type { AutoFillPlan } from "../autofill/buildPlan";

type Props = {
  plan: AutoFillPlan;
  /** Total AcroForm field descriptors discovered by useFormFields,
   *  including unmatched ones. Used to distinguish a flat PDF (zero
   *  fields found) from one with cryptic names (fields found but
   *  nothing matched). */
  totalFieldsDetected: number;
  onApply: () => void;
  onClose: () => void;
  t: (key: TranslationKey) => string;
};

/**
 * Preview-and-confirm modal shown after `buildPlan` has produced a
 * plan but before any mutation is applied. The user sees a summary
 * of what will change, the list of unmatched fields, and decides
 * whether to commit.
 */
export function AutoFillModal({ plan, totalFieldsDetected, onApply, onClose, t }: Props) {
  const matchedFieldCount = plan.stats.matchedText + plan.stats.matchedChoice;
  const hasAnythingToApply =
    matchedFieldCount > 0 || plan.stats.matchedSignature > 0 || plan.paraph !== null;
  const mediumParaph = plan.paraphCandidate?.confidence === "medium";
  // Distinguish "the PDF has no fillable widgets at all" from "we
  // found widgets but couldn't match any of them" — these need very
  // different explanations.
  const isFlatPdf = totalFieldsDetected === 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card autofill-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t("autofill_title")}</h3>
          <button className="btn icon-btn" onClick={onClose} aria-label={t("signature_cancel")}>
            ×
          </button>
        </div>

        <ul className="autofill-summary">
          <li>
            <strong>{matchedFieldCount}</strong> {t("autofill_text_fields")}
          </li>
          <li>
            <strong>{plan.stats.matchedSignature}</strong> {t("autofill_signatures")}
          </li>
          {plan.paraph && (
            <li>
              <strong>1</strong> {t("autofill_paraph")} ✓
            </li>
          )}
        </ul>

        {!hasAnythingToApply && isFlatPdf && (
          <p className="hint autofill-warning">{t("autofill_flat_pdf")}</p>
        )}

        {!hasAnythingToApply && !isFlatPdf && (
          <p className="hint autofill-warning">{t("autofill_no_matches")}</p>
        )}

        {mediumParaph && !plan.paraph && (
          <p className="hint autofill-warning">{t("autofill_paraph_medium")}</p>
        )}

        {plan.unmatched.length > 0 && (
          <details className="autofill-unmatched">
            <summary>
              {plan.unmatched.length} {t("autofill_unmatched")}
            </summary>
            <ul>
              {plan.unmatched.map((field) => (
                <li key={`${field.type}-${field.name}`}>
                  <code>{field.name}</code>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="modal-actions">
          <div className="modal-actions-right">
            <button className="btn" onClick={onClose}>
              {t("signature_cancel")}
            </button>
            <button
              className="btn primary"
              onClick={onApply}
              disabled={!hasAnythingToApply}
            >
              {t("autofill_apply")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
