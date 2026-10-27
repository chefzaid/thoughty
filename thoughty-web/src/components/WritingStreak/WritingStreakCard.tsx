import { useId, useState } from 'react';

import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { formatEntryDate } from '../../utils/entryDate';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { mutedTextClass } from '../../utils/tintedText';
import { formatBinDate } from '../RecycleBin/recycleBinFormat';
import { useWritingStreak } from './useWritingStreak';
import { dismissOn, isDismissedOn, writingStreakView } from './writingStreakState';

interface WritingStreakCardProps {
  /** The diary the journal shows, or null for all of them. */
  readonly diaryId: number | null;
  /** Whether the writer keeps the card on in Profile. */
  readonly enabled: boolean;
  /** Puts the cursor in the composer. */
  readonly onWriteNow: () => void;
  /** Opens an entry through its permalink. */
  readonly onOpenEntry: (entryId: number) => void;
  readonly language: Language;
  readonly theme: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/**
 * A small card above the composer: the days in a row the writer has written, or after a break an offer
 * to pick up from the last entry. Warm and optional: it never mentions a streak that ended, and it can
 * be hidden for the day here or turned off in Profile.
 */
function WritingStreakCard({ diaryId, enabled, onWriteNow, onOpenEntry, language, theme, t }: WritingStreakCardProps) {
  const today = formatEntryDate(new Date());
  const headingId = useId();
  const [dismissedOn, setDismissedOn] = useState<string | null>(() => (isDismissedOn(today) ? today : null));
  const hidden = !enabled || dismissedOn === today;
  const { data } = useWritingStreak(diaryId, today, !hidden);
  const view = hidden ? null : writingStreakView(data);
  if (!view) return null;

  const isDark = theme !== 'light';
  const muted = mutedTextClass(isDark);
  const buttonClass = `inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${isDark
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
    : 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100'
    }`;
  const dismiss = () => {
    dismissOn(today);
    setDismissedOn(today);
  };

  return (
    <section
      aria-labelledby={headingId}
      className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 ${isDark
        ? 'border-amber-500/30 bg-gray-800 text-gray-100'
        : 'border-amber-200 bg-amber-50 text-gray-900'
        }`}
      data-testid="writing-streak-card"
    >
      <span
        className={`codicon ${view.kind === 'streak' ? 'codicon-calendar' : 'codicon-history'} mt-0.5 text-lg ${isDark ? 'text-amber-300' : 'text-amber-700'}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        {view.kind === 'streak' ? (
          <>
            <h2 id={headingId} className="sr-only">{t('writingStreakRegion')}</h2>
            <p className="font-semibold">{pluralPhrase(t, 'writingStreakDays', view.days, language)}</p>
            <p className={`text-sm ${muted}`}>
              {t(view.writtenToday ? 'writingStreakWrittenToday' : 'writingStreakOpenToday')}
            </p>
          </>
        ) : (
          <>
            <h2 id={headingId} className="font-semibold">{t('writingStreakResumeTitle')}</h2>
            <p className={`text-sm ${muted}`}>
              {t('writingStreakResumeIntro', { date: formatBinDate(view.entry.date, language) })}
            </p>
            <blockquote className="mt-2 border-l-2 border-amber-400/60 pl-3 text-sm">
              <p className="font-medium">{view.entry.title || t('writingStreakUntitled')}</p>
              {view.entry.snippet && <p className={`line-clamp-2 ${muted}`}>{view.entry.snippet}</p>}
            </blockquote>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={buttonClass} onClick={onWriteNow}>
                <span className="codicon codicon-edit" aria-hidden="true" />
                {t('writingStreakWriteNow')}
              </button>
              <button type="button" className={buttonClass} onClick={() => onOpenEntry(view.entry.id)}>
                <span className="codicon codicon-book" aria-hidden="true" />
                {t('writingStreakReread')}
              </button>
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('writingStreakDismiss')}
        title={t('writingStreakDismissHint')}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-amber-100'}`}
      >
        <span className="codicon codicon-close" aria-hidden="true" />
      </button>
    </section>
  );
}

export default WritingStreakCard;
