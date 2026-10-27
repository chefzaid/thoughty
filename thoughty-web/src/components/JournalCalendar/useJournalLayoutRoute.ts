import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ENTRY_PERMALINK_PARAM, JOURNAL_LAYOUT_PARAM, JOURNAL_MONTH_PARAM } from '../../utils/appRouting';
import { formatCalendarMonth, parseCalendarMonth, type CalendarMonth } from '../../utils/calendarMonth';

export type JournalLayout = 'list' | 'calendar';

/**
 * The journal's layout, kept in its URL beside the diary and the saved search (`?diary=2&layout=calendar&month=2026-10`)
 * so a calendar month can be bookmarked: switching layout adds a history step, moving between months replaces it.
 */
export function useJournalLayoutRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const layout: JournalLayout = searchParams.get(JOURNAL_LAYOUT_PARAM) === 'calendar' ? 'calendar' : 'list';
  const month = layout === 'calendar' ? parseCalendarMonth(searchParams.get(JOURNAL_MONTH_PARAM)) : null;

  const setLayout = useCallback((next: JournalLayout) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      if (next === 'calendar') {
        params.set(JOURNAL_LAYOUT_PARAM, 'calendar');
        // The calendar opens its own entries; an entry link opened before stays behind
        params.delete(ENTRY_PERMALINK_PARAM);
      } else {
        params.delete(JOURNAL_LAYOUT_PARAM);
        params.delete(JOURNAL_MONTH_PARAM);
      }
      return params;
    });
  }, [setSearchParams]);

  const setMonth = useCallback((next: CalendarMonth) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous);
      params.set(JOURNAL_MONTH_PARAM, formatCalendarMonth(next));
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  /** Shows an entry in the list through its permalink, which finds the page it is on among all diaries. */
  const openEntry = useCallback((entryId: number) => {
    setSearchParams(new URLSearchParams({ diary: 'all', [ENTRY_PERMALINK_PARAM]: String(entryId) }));
  }, [setSearchParams]);

  return { layout, month, setLayout, setMonth, openEntry };
}
