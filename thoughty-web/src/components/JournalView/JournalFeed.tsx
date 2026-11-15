import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Entry, TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { mutedTextClass } from '../../utils/tintedText';
import { JOURNAL_BATCH_SIZE } from '../../hooks/useJournalList';
import { useLoadOnApproach } from '../../hooks/useLoadOnApproach';
import { useFeedKeyboard } from './useFeedKeyboard';
import { useKeepScrollPlace } from './useKeepScrollPlace';

/** The infinite scroll's state, as `useEntries` gives it. */
export interface JournalFeedState {
  total: number;
  hasOlder: boolean;
  hasNewer: boolean;
  loadingOlder: boolean;
  loadingNewer: boolean;
  loadError: boolean;
  loadOlder: () => void;
  loadNewer: () => void;
}

interface JournalFeedProps {
  readonly feed: JournalFeedState;
  readonly entries: readonly Entry[];
  /** Whether the list is read again as a whole (new filters, a jump): nothing loads at the ends meanwhile. */
  readonly reloading: boolean;
  /** Whether newer entries load by themselves as the top comes near; off while a jump scrolls to its entry. */
  readonly autoLoadNewer: boolean;
  readonly language: Language;
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
  readonly children: ReactNode;
}

type Side = 'older' | 'newer';

/**
 * The journal list as infinite scroll: the next entries load as the end of the list comes near, and newer
 * ones above it after a jump or once the oldest batches shown were let go of (the screen stays on what it
 * showed while they come and go). **Show newer
 * entries** and **Load more entries** do the same from the keyboard, for assistive technologies and
 * where IntersectionObserver is missing; when a button goes away with the last batch, focus moves to the
 * first entry it brought. A polite status says how many entries came and how many are shown.
 */
export default function JournalFeed({ feed, entries, reloading, autoLoadNewer, language, theme, t, children }: JournalFeedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const olderMarker = useRef<HTMLDivElement>(null);
  const newerMarker = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const { total, hasOlder, hasNewer, loadingOlder, loadingNewer, loadError, loadOlder, loadNewer } = feed;
  const entryIds = useMemo(() => entries.map((entry) => entry.id), [entries]);

  // A batch loaded at either end is announced, and a button that went away with it hands focus on
  const loading = useRef<{ side: Side; count: number; fromButton: boolean; edgeId: number | undefined } | null>(null);
  const remember = useCallback((side: Side, fromButton: boolean) => {
    loading.current ??= { side, count: entries.length, fromButton, edgeId: side === 'older' ? entries.at(-1)?.id : entries[0]?.id };
  }, [entries]);
  const loadOlderFrom = useCallback((fromButton: boolean) => {
    remember('older', fromButton);
    loadOlder();
  }, [loadOlder, remember]);
  const loadNewerFrom = useCallback((fromButton: boolean) => {
    remember('newer', fromButton);
    loadNewer();
  }, [loadNewer, remember]);
  // Loads started elsewhere (the arrow keys) are announced too
  useEffect(() => {
    if (loadingOlder) remember('older', false);
    if (loadingNewer) remember('newer', false);
  }, [loadingNewer, loadingOlder, remember]);
  const autoLoadOlder = useCallback(() => loadOlderFrom(false), [loadOlderFrom]);
  const autoLoadNewerBatch = useCallback(() => loadNewerFrom(false), [loadNewerFrom]);

  useLoadOnApproach(olderMarker, hasOlder && !reloading && !loadingOlder && !loadError, autoLoadOlder);
  useLoadOnApproach(newerMarker, hasNewer && autoLoadNewer && !reloading && !loadingNewer && !loadError, autoLoadNewerBatch);
  useFeedKeyboard({ container: containerRef, entryIds, hasOlder, hasNewer, loadOlder, loadNewer });

  useKeepScrollPlace(containerRef, loadingOlder || loadingNewer, entryIds[0]);

  useEffect(() => {
    const batch = loading.current;
    if (!batch || loadingOlder || loadingNewer) return;
    loading.current = null;
    // Counted from the entry at that end before, since the batches at the other end may have been let go of
    const edge = entries.findIndex((entry) => entry.id === batch.edgeId);
    let added = entries.length - batch.count;
    if (edge >= 0) added = batch.side === 'older' ? entries.length - 1 - edge : edge;
    if (added <= 0) return;
    setAnnouncement(pluralPhrase(t, 'journalFeedLoaded', added, language, {
      shown: entries.length.toLocaleString(language),
      total: total.toLocaleString(language),
    }));
    const buttonGone = batch.side === 'older' ? !hasOlder : !hasNewer;
    if (batch.fromButton && buttonGone) {
      const firstNew = batch.side === 'older' ? entries[edge + 1] : entries[0];
      const article = firstNew && containerRef.current?.querySelector<HTMLElement>(`article[data-entry-id="${firstNew.id}"]`);
      article?.focus({ preventScroll: true });
    }
  }, [entries, hasNewer, hasOlder, language, loadingNewer, loadingOlder, t, total]);

  const isDark = theme !== 'light';
  const buttonClass = `mx-auto flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${isDark
    ? 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`;
  const noteClass = `text-center text-sm ${mutedTextClass(isDark)}`;
  const spinner = <span className="codicon codicon-loading codicon-modifier-spin" aria-hidden="true" />;
  const loadButton = (side: Side) => {
    const busy = side === 'older' ? loadingOlder : loadingNewer;
    return (
      <button type="button" className={buttonClass} aria-disabled={busy} onClick={() => { if (!busy) (side === 'older' ? loadOlderFrom : loadNewerFrom)(true); }}>
        {busy ? spinner : <span className={`codicon codicon-chevron-${side === 'older' ? 'down' : 'up'}`} aria-hidden="true" />}
        {busy ? t('loadingMoreEntries') : t(side === 'older' ? 'loadMoreEntries' : 'loadNewerEntries')}
      </button>
    );
  };

  return (
    <div ref={containerRef}>
      {hasNewer && entries.length > 0 && (
        <div className="mb-4">
          <div ref={newerMarker} aria-hidden="true" />
          {loadButton('newer')}
        </div>
      )}
      {children}
      <div ref={olderMarker} aria-hidden="true" />
      {loadError && <p className={`mt-4 ${noteClass}`} role="alert">{t('journalFeedLoadError')}</p>}
      {hasOlder && entries.length > 0 && <div className="mt-6">{loadButton('older')}</div>}
      {!hasOlder && !reloading && total > JOURNAL_BATCH_SIZE && <p className={`mt-6 ${noteClass}`}>{t('journalFeedEnd')}</p>}
      <p className="sr-only" role="status">{announcement}</p>
    </div>
  );
}
