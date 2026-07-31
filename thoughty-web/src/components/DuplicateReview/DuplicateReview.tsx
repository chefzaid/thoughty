import { useEffect, useRef, useState } from 'react';
import type { DuplicateEntryScan } from '../../services/api/aiService';
import type { TranslationFunction } from '../../types';
import './DuplicateReview.css';

interface DuplicateReviewProps {
  readonly diaryId: number | null;
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
  readonly onFindDuplicates: (diaryId?: number) => Promise<DuplicateEntryScan | null>;
  readonly onDelete: (entryId: number) => void;
  readonly onNavigateToEntry: (date: string, index: number) => void;
}

function DuplicateReview({
  diaryId,
  theme,
  t,
  onFindDuplicates,
  onDelete,
  onNavigateToEntry,
}: Readonly<DuplicateReviewProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scan, setScan] = useState<DuplicateEntryScan | null>(null);
  const [failed, setFailed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);
  const isLight = theme === 'light';

  useEffect(() => {
    setIsOpen(false);
    setScan(null);
    setFailed(false);
  }, [diaryId]);

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) triggerButtonRef.current?.focus();
      wasOpenRef.current = false;
      return undefined;
    }
    wasOpenRef.current = true;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
      if (event.key !== 'Tab') return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
      );
      if (!focusableElements || focusableElements.length === 0) return;
      const first = focusableElements.item(0);
      const last = focusableElements.item(focusableElements.length - 1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const runScan = async () => {
    setIsOpen(true);
    setLoading(true);
    setFailed(false);
    setScan(null);
    const result = await onFindDuplicates(diaryId ?? undefined);
    setLoading(false);
    setFailed(result === null);
    setScan(result);
  };

  const leaveDialog = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div className="duplicate-review">
      <button
        ref={triggerButtonRef}
        type="button"
        className={`duplicate-review-trigger ${isLight ? 'light' : 'dark'}`}
        onClick={() => void runScan()}
      >
        <span className="codicon codicon-copy" aria-hidden="true" />
        {t('findDuplicates')}
      </button>

      {isOpen && (
        <div className="duplicate-review-overlay">
          <button
            type="button"
            className="duplicate-review-backdrop"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setIsOpen(false)}
          />
          <section
            ref={dialogRef}
            className={`duplicate-review-dialog ${isLight ? 'light' : 'dark'}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-review-title"
          >
            <header className="duplicate-review-header">
              <div>
                <h2 id="duplicate-review-title">{t('duplicateScanTitle')}</h2>
                <p>{t('duplicateScanDescription')}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                className="duplicate-icon-button"
                aria-label={t('close')}
                title={t('close')}
                onClick={() => setIsOpen(false)}
              >
                <span className="codicon codicon-close" aria-hidden="true" />
              </button>
            </header>

            <div className="duplicate-review-content" aria-live="polite">
              {loading && <p className="duplicate-review-state">{t('scanningDuplicates')}</p>}
              {failed && (
                <div className="duplicate-review-state error" role="alert">
                  <p>{t('duplicateScanError')}</p>
                  <button type="button" onClick={() => void runScan()}>{t('tryAgain')}</button>
                </div>
              )}
              {scan && (
                <>
                  <p className="duplicate-scan-count">
                    {t('duplicateScanCount', {
                      analyzed: scan.analyzedEntries,
                      total: scan.totalEntries,
                    })}
                  </p>
                  {scan.truncated && <p className="duplicate-scan-limit">{t('duplicateScanLimited')}</p>}
                  {scan.groups.length === 0 && (
                    <p className="duplicate-review-state">{t('noDuplicatesFound')}</p>
                  )}
                  {scan.groups.map((group) => (
                    <section className="duplicate-group" key={group.entries.map((entry) => entry.id).join('-')}>
                      <div className="duplicate-group-summary">
                        <strong>{t('duplicateConfidence', { confidence: group.confidence })}</strong>
                        <p>{group.reason}</p>
                      </div>
                      {group.entries.map((entry) => (
                        <article className="duplicate-entry-row" key={entry.id}>
                          <div className="duplicate-entry-copy">
                            <time dateTime={entry.date}>{entry.date}</time>
                            <p>{entry.content}</p>
                            {entry.tags.length > 0 && <small>{entry.tags.join(', ')}</small>}
                          </div>
                          <div className="duplicate-entry-actions">
                            <button
                              type="button"
                              title={t('openDuplicateEntry')}
                              aria-label={t('openDuplicateEntry')}
                              onClick={() => leaveDialog(() => onNavigateToEntry(entry.date, entry.index))}
                            >
                              <span className="codicon codicon-go-to-file" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="danger"
                              title={t('deleteDuplicateEntry')}
                              aria-label={t('deleteDuplicateEntry')}
                              onClick={() => leaveDialog(() => onDelete(entry.id))}
                            >
                              <span className="codicon codicon-trash" aria-hidden="true" />
                            </button>
                          </div>
                        </article>
                      ))}
                    </section>
                  ))}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default DuplicateReview;
