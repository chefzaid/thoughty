import { useEffect, useId } from 'react';

import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { formatJournalDate } from '../../utils/entryDate';
import { mutedTextClass } from '../../utils/tintedText';
import type { SavedEntry } from './comfortReadsState';
import { useComfortReads } from './useComfortReads';

interface ComfortReadsCardProps {
  /** The entry the composer saved last, or null before any. */
  readonly saved: SavedEntry | null;
  /** Whether the writer keeps the offer on in Profile. */
  readonly enabled: boolean;
  /** Opens one of the offered entries in the reader, which turns through all of them. */
  readonly onOpenEntry: (entryId: number, offeredIds: readonly number[]) => void;
  readonly language: Language;
  readonly theme: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/** Escape belongs to whatever has it: a dialog, a field, a menu that already handled it. */
function leavesEscapeToOthers(event: KeyboardEvent): boolean {
  const target = event.target;
  return event.defaultPrevented
    || (target instanceof HTMLElement
      && (target.closest('[role="dialog"]') !== null
        || target.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)));
}

/**
 * Below the composer, right after the writer saves an entry with a very low mood: a quiet offer to reread up
 * to three entries they kept as favorites or tagged with gratitude, with "Not now". It never takes focus; it
 * is announced politely, and Escape (or "Not now") puts it away until another day.
 */
function ComfortReadsCard({ saved, enabled, onOpenEntry, language, theme, t }: ComfortReadsCardProps) {
  const headingId = useId();
  const { entries, dismiss } = useComfortReads(saved, enabled);
  const shown = entries !== null;

  useEffect(() => {
    if (!shown) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !leavesEscapeToOthers(event)) dismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dismiss, shown]);

  const isDark = theme !== 'light';
  const muted = mutedTextClass(isDark);
  const offeredIds = entries?.map((entry) => entry.id) ?? [];

  return (
    <>
      <p className="sr-only" role="status">
        {shown ? `${t('comfortReadsTitle')} ${t('comfortReadsIntro')}` : ''}
      </p>
      {entries && (
        <section
          aria-labelledby={headingId}
          data-testid="comfort-reads"
          onKeyDown={(event) => {
            // Inside the card, Escape is the card's own
            if (event.key === 'Escape') {
              event.preventDefault();
              dismiss();
            }
          }}
          className={`mb-4 rounded-xl border px-4 py-3 ${isDark
            ? 'border-rose-400/30 bg-gray-800 text-gray-100'
            : 'border-rose-200 bg-rose-50 text-gray-900'
            }`}
        >
          <div className="flex items-start gap-3">
            <span className={`codicon codicon-heart mt-0.5 text-lg ${isDark ? 'text-rose-300' : 'text-rose-700'}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 id={headingId} className="font-semibold">{t('comfortReadsTitle')}</h2>
              <p className={`text-sm ${muted}`}>{t('comfortReadsIntro')}</p>
            </div>
          </div>
          <ul className="mt-3 space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => onOpenEntry(entry.id, offeredIds)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${isDark
                    ? 'border-gray-600 bg-gray-900 hover:bg-gray-700'
                    : 'border-rose-200 bg-white hover:bg-rose-100'
                    }`}
                >
                  <span className="block text-sm font-medium">
                    {formatJournalDate(entry.date, language)}
                    {' · '}
                    {entry.title || t('comfortReadsUntitled')}
                  </span>
                  {entry.excerpt && (
                    <span className={`privacy-text mt-0.5 line-clamp-2 block text-sm ${muted}`}>{entry.excerpt}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={dismiss}
              title={t('comfortReadsNotNowHint')}
              className={`h-9 rounded-lg px-3 text-sm font-medium transition-colors ${isDark ? 'text-gray-200 hover:bg-gray-700' : 'text-gray-700 hover:bg-rose-100'}`}
            >
              {t('comfortReadsNotNow')}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

export default ComfortReadsCard;
