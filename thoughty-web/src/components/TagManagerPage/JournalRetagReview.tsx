import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApiServices } from "../../hooks/useApiServices";
import type {
  JournalRetagMode,
  JournalRetagPlan,
} from "../../services/api/aiService";
import type { TranslationFunction } from "../ProfilePage/types";
import "./JournalRetagReview.css";

interface JournalRetagReviewProps {
  readonly isDark: boolean;
  readonly onApplied: () => Promise<void>;
  readonly t: TranslationFunction;
}

function tagsMatch(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((tag, index) => tag === right[index])
  );
}

function JournalRetagReview({ isDark, onApplied, t }: JournalRetagReviewProps) {
  const { aiService } = useApiServices();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [plan, setPlan] = useState<JournalRetagPlan | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<JournalRetagMode>("replace");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [appliedCount, setAppliedCount] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) triggerRef.current?.focus();
      wasOpenRef.current = false;
      return undefined;
    }
    if (!wasOpenRef.current) closeRef.current?.focus();
    wasOpenRef.current = true;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !applying) setIsOpen(false);
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), input:not(:disabled)",
      );
      if (!focusable?.length) return;
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [applying, isOpen]);

  const loadPlan = async () => {
    setLoading(true);
    setError("");
    setPlan(null);
    setAppliedCount(null);
    const result = await aiService.previewJournalRetag();
    setLoading(false);
    if (!result.data) {
      setError(result.error || t("journalRetagError"));
      return;
    }
    setPlan(result.data);
    setSelectedIds(
      new Set(
        result.data.entries
          .filter((entry) => !tagsMatch(entry.currentTags, entry.suggestedTags))
          .map((entry) => entry.id),
      ),
    );
  };

  const openReview = () => {
    setIsOpen(true);
    setMode("replace");
    void loadPlan();
  };

  const toggleEntry = (entryId: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const applyPlan = async () => {
    if (!plan || selectedIds.size === 0) return;
    setApplying(true);
    setError("");
    const assignments = plan.entries
      .filter((entry) => selectedIds.has(entry.id))
      .map((entry) => ({ entryId: entry.id, tags: entry.suggestedTags }));
    const result = await aiService.applyJournalRetag(mode, assignments);
    setApplying(false);
    if (!result.data?.success) {
      setError(result.error || t("journalRetagApplyError"));
      return;
    }
    setAppliedCount(result.data.affectedEntries);
    try {
      await onApplied();
    } catch {
      // The server update succeeded; a later route refresh can reconcile the list.
    }
  };

  const allSelected =
    Boolean(plan?.entries.length) && selectedIds.size === plan?.entries.length;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="journal-retag-trigger"
        onClick={openReview}
      >
        <span className="codicon codicon-wand" aria-hidden="true" />
        {t("organizeJournalThemes")}
      </button>

      {isOpen &&
        createPortal(
          <div className="journal-retag-overlay">
            <button
              type="button"
              className="journal-retag-backdrop"
              aria-hidden="true"
              tabIndex={-1}
              disabled={applying}
              onClick={() => setIsOpen(false)}
            />
            <section
              ref={dialogRef}
              className={`journal-retag-dialog ${isDark ? "dark" : "light"}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="journal-retag-title"
            >
              <header className="journal-retag-header">
                <div>
                  <h2 id="journal-retag-title">{t("journalRetagTitle")}</h2>
                  <p>{t("journalRetagDescription")}</p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  className="journal-retag-icon-button"
                  disabled={applying}
                  aria-label={t("close")}
                  title={t("close")}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="codicon codicon-close" aria-hidden="true" />
                </button>
              </header>

              <div className="journal-retag-content" aria-live="polite">
                {loading && (
                  <p className="journal-retag-state">
                    {t("scanningJournalThemes")}
                  </p>
                )}
                {error && (
                  <div className="journal-retag-state error" role="alert">
                    <p>{error}</p>
                    {!plan && (
                      <button type="button" onClick={() => void loadPlan()}>
                        {t("tryAgain")}
                      </button>
                    )}
                  </div>
                )}
                {appliedCount !== null && (
                  <div className="journal-retag-state success">
                    <span
                      className="codicon codicon-check"
                      aria-hidden="true"
                    />
                    <p>{t("journalRetagApplied", { count: appliedCount })}</p>
                  </div>
                )}
                {plan && appliedCount === null && (
                  <>
                    <div className="journal-retag-summary">
                      <p>
                        {t("journalRetagScanCount", {
                          analyzed: plan.analyzedEntries,
                          total: plan.totalEntries,
                        })}
                      </p>
                      {plan.truncated && (
                        <p className="warning">{t("journalRetagLimited")}</p>
                      )}
                      {plan.themes.length > 0 && (
                        <div
                          className="journal-retag-themes"
                          aria-label={t("journalThemesFound")}
                        >
                          {plan.themes.map((theme) => (
                            <span key={theme}>#{theme}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {plan.entries.length === 0 ? (
                      <p className="journal-retag-state">
                        {t("journalRetagEmpty")}
                      </p>
                    ) : (
                      <>
                        <div className="journal-retag-toolbar">
                          <div
                            className="journal-retag-mode"
                            aria-label={t("journalRetagMode")}
                          >
                            <button
                              type="button"
                              aria-pressed={mode === "replace"}
                              onClick={() => setMode("replace")}
                            >
                              {t("journalRetagReplace")}
                            </button>
                            <button
                              type="button"
                              aria-pressed={mode === "add"}
                              onClick={() => setMode("add")}
                            >
                              {t("journalRetagAdd")}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="journal-retag-selection"
                            onClick={() =>
                              setSelectedIds(
                                allSelected
                                  ? new Set()
                                  : new Set(
                                      plan.entries.map((entry) => entry.id),
                                    ),
                              )
                            }
                          >
                            {allSelected ? t("clearSelection") : t("selectAll")}
                          </button>
                        </div>

                        <div className="journal-retag-entries">
                          {plan.entries.map((entry) => (
                            <label
                              className="journal-retag-entry"
                              key={entry.id}
                            >
                              <input
                                type="checkbox"
                                checked={selectedIds.has(entry.id)}
                                onChange={() => toggleEntry(entry.id)}
                              />
                              <time dateTime={entry.date}>
                                {entry.date}
                                {entry.index > 1 ? ` #${entry.index}` : ""}
                              </time>
                              <div>
                                <small>{t("currentTags")}</small>
                                <p>
                                  {entry.currentTags.length > 0
                                    ? entry.currentTags.join(", ")
                                    : t("noTags")}
                                </p>
                              </div>
                              <span
                                className="codicon codicon-arrow-right"
                                aria-hidden="true"
                              />
                              <div>
                                <small>{t("suggestedThemes")}</small>
                                <p>
                                  {entry.suggestedTags.length > 0
                                    ? entry.suggestedTags.join(", ")
                                    : t("noThemes")}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {plan && plan.entries.length > 0 && appliedCount === null && (
                <footer className="journal-retag-footer">
                  <span>
                    {t("journalRetagSelected", { count: selectedIds.size })}
                  </span>
                  <button
                    type="button"
                    className="journal-retag-apply"
                    disabled={selectedIds.size === 0 || applying}
                    onClick={() => void applyPlan()}
                  >
                    {applying && (
                      <span
                        className="codicon codicon-loading codicon-modifier-spin"
                        aria-hidden="true"
                      />
                    )}
                    {applying
                      ? t("applyingJournalRetag")
                      : t("applyJournalRetag")}
                  </button>
                </footer>
              )}
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

export default JournalRetagReview;
