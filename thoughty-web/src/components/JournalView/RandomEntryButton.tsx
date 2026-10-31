import { useId, useMemo, useState } from 'react';

import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createRandomEntryService } from '../../services/api/randomEntryService';
import type { EntryListQuery } from '../../services/api/entryListQuery';
import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { formatEraDate } from '../../utils/lifeEras';
import { tintedTextClass } from '../../utils/tintedText';

interface RandomEntryButtonProps {
  /** The journal list's query: the entry is picked among the same filters, at its page size and order. */
  readonly query: EntryListQuery;
  /** Whether the filtered list has no entry, so there is nothing to pick from. */
  readonly listEmpty: boolean;
  /** Shows the picked entry on its page of the list, keeping the filters. */
  readonly onOpen: (entryId: number, page: number) => void;
  /** Shows a message in the app's notice toast. */
  readonly onNotify: (message: string) => void;
  readonly language: Language;
  readonly theme?: 'light' | 'dark';
  readonly t: TranslationFunction;
}

/** The filters a pick was made among: the list query without its page, which the pick itself moves. */
function filtersKey({ page: _page, ...filters }: EntryListQuery): string {
  return JSON.stringify(filters);
}

/**
 * "Random entry" in the journal filter tools: opens an entry picked at random among the current filters
 * on its page of the list. Asked again with the same filters, it reads "Another one" and does not land on
 * the entry it just showed.
 */
function RandomEntryButton({ query, listEmpty, onOpen, onNotify, language, theme, t }: RandomEntryButtonProps) {
  const service = useAuthenticatedService(createRandomEntryService);
  const hintId = useId();
  const [busy, setBusy] = useState(false);
  const [lastPick, setLastPick] = useState<{ id: number; filters: string } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const filters = useMemo(() => filtersKey(query), [query]);
  const lastId = lastPick?.filters === filters ? lastPick.id : null;
  const unavailable = listEmpty || busy;

  const pick = async () => {
    if (unavailable) return;
    setBusy(true);
    const result = await service.pick(query, lastId);
    setBusy(false);
    if (!result.data) {
      onNotify(t(result.error ?? 'randomEntryFailed'));
      return;
    }
    setLastPick({ id: result.data.id, filters });
    setAnnouncement(t('randomEntryOpened', { date: formatEraDate(result.data.date, language) }));
    onOpen(result.data.id, result.data.page);
  };

  const label = t(lastId === null ? 'randomEntry' : 'randomEntryAnother');
  return (
    <>
      <button
        type="button"
        onClick={() => void pick()}
        aria-disabled={unavailable}
        aria-describedby={hintId}
        title={t(listEmpty ? 'randomEntryEmpty' : 'randomEntryHint')}
        className={`random-entry-button flex h-10 shrink-0 items-center gap-2 rounded-lg border border-teal-500/50 bg-teal-500/10 px-4 text-sm font-medium transition-all ${tintedTextClass('teal', theme)} ${unavailable ? 'cursor-not-allowed opacity-50' : 'hover:bg-teal-500/20'}`}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
        </svg>
        {label}
      </button>
      <span id={hintId} className="sr-only">{t(listEmpty ? 'randomEntryEmpty' : 'randomEntryHint')}</span>
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </>
  );
}

export default RandomEntryButton;
