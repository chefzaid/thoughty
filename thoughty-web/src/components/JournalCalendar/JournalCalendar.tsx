import { useEffect, useId, useRef, useState } from 'react';

import type { EntryCalendarItem, EntryCalendarQuery } from '../../services/api';
import type { Theme, TranslationFunction } from '../../types';
import {
  addMonths,
  calendarDate,
  formatCalendarMonth,
  monthOfDate,
  sameMonth,
  type CalendarMonth,
} from '../../utils/calendarMonth';
import { formatEntryDate } from '../../utils/entryDate';
import type { Language } from '../../utils/translations';
import CalendarGrid from './CalendarGrid';
import { useCalendarMonth } from './useCalendarMonth';

interface JournalCalendarProps {
  /** The month in the journal URL; without one, the month of the date filter, else this month. */
  readonly month: CalendarMonth | null;
  readonly onMonthChange: (month: CalendarMonth) => void;
  /** The journal filters and diary, without the month. */
  readonly filters: Omit<EntryCalendarQuery, 'month'>;
  /** The journal's date filter (`YYYY-MM-DD`), marked in the grid. */
  readonly selectedDate: string | null;
  /** Years that have entries, offered to jump to. */
  readonly availableYears: readonly number[];
  readonly onOpenDay: (date: string) => void;
  readonly onOpenEntry: (entry: EntryCalendarItem) => void;
  readonly language: Language;
  readonly theme: Theme;
  readonly t: TranslationFunction;
}

function monthTitle({ year, month }: CalendarMonth, language: Language): string {
  const utc = new Date(Date.UTC(2000, month - 1, 1));
  utc.setUTCFullYear(year);
  const title = new Intl.DateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utc);
  return title.charAt(0).toLocaleUpperCase(language) + title.slice(1);
}

function initialFocus(month: CalendarMonth, selectedDate: string | null, today: string): string {
  if (selectedDate && sameMonth(monthOfDate(selectedDate), month)) return selectedDate;
  if (sameMonth(monthOfDate(today), month)) return today;
  return calendarDate(month, 1);
}

/** The journal as a month grid of the entries that match the filters, with month and year navigation. */
function JournalCalendar({
  month,
  onMonthChange,
  filters,
  selectedDate,
  availableYears,
  onOpenDay,
  onOpenEntry,
  language,
  theme,
  t,
}: JournalCalendarProps) {
  const titleId = useId();
  const helpId = useId();
  const today = formatEntryDate(new Date());
  const shown = month ?? monthOfDate(selectedDate ?? today);
  const [activeDate, setActiveDate] = useState(() => initialFocus(shown, selectedDate, today));
  const focusDate = sameMonth(monthOfDate(activeDate), shown)
    ? activeDate
    : calendarDate(shown, Number(activeDate.slice(8, 10)));
  const { entriesByDate, total, loading, failed, retry } = useCalendarMonth({
    ...filters,
    month: formatCalendarMonth(shown),
  });
  const isLight = theme === 'light';

  const goToDate = (date: string) => {
    setActiveDate(date);
    const target = monthOfDate(date);
    if (!sameMonth(target, shown)) onMonthChange(target);
  };
  const goToMonth = (target: CalendarMonth) => goToDate(calendarDate(target, Number(focusDate.slice(8, 10))));

  // A date picked in the filter bar brings its month into view
  const previousSelectedDate = useRef(selectedDate);
  useEffect(() => {
    if (selectedDate === previousSelectedDate.current) return;
    previousSelectedDate.current = selectedDate;
    if (!selectedDate) return;
    setActiveDate(selectedDate);
    const target = monthOfDate(selectedDate);
    if (!sameMonth(target, shown)) onMonthChange(target);
  }, [onMonthChange, selectedDate, shown]);

  const years = [...new Set([...availableYears, shown.year])].sort((left, right) => right - left);
  const navButtonClass = `grid h-9 w-9 shrink-0 place-items-center rounded-md border ${isLight
    ? 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
    : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800'}`;
  const navigation = [
    { labelKey: 'calendarPreviousYear', symbol: '«', months: -12 },
    { labelKey: 'calendarPreviousMonth', symbol: '‹', months: -1 },
    { labelKey: 'calendarNextMonth', symbol: '›', months: 1 },
    { labelKey: 'calendarNextYear', symbol: '»', months: 12 },
  ] as const;
  const mutedText = isLight ? 'text-gray-600' : 'text-gray-400';

  return (
    <section
      className={`journal-calendar mb-8 rounded-lg border p-3 sm:p-4 ${isLight ? 'border-gray-200 bg-white/50' : 'border-gray-700/50 bg-gray-800/50'}`}
      aria-labelledby={titleId}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id={titleId} aria-live="polite" className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
          {monthTitle(shown, language)}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {navigation.map(({ labelKey, symbol, months }) => (
            <button
              key={labelKey}
              type="button"
              className={navButtonClass}
              aria-label={t(labelKey)}
              title={t(labelKey)}
              onClick={() => goToMonth(addMonths(shown, months))}
            >
              <span aria-hidden="true" className="text-lg leading-none">{symbol}</span>
            </button>
          ))}
          <select
            value={shown.year}
            aria-label={t('calendarGoToYear')}
            title={t('calendarGoToYear')}
            onChange={(event) => goToMonth({ year: Number(event.target.value), month: shown.month })}
            className={`h-9 rounded-md border px-2 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isLight
              ? 'border-gray-300 bg-gray-50 text-gray-900'
              : 'border-gray-700 bg-gray-900 text-gray-100'}`}
          >
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <button
            type="button"
            className={`h-9 rounded-md border px-3 text-sm font-medium ${isLight
              ? 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
              : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800'}`}
            onClick={() => goToDate(today)}
          >
            {t('calendarToday')}
          </button>
        </div>
      </div>
      <p id={helpId} className={`mb-2 hidden text-xs sm:block ${mutedText}`}>{t('calendarKeyboardHelp')}</p>
      <div className={`mb-2 min-h-5 text-sm ${mutedText}`} aria-live="polite">
        {failed && (
          <p role="alert" className={isLight ? 'text-red-700' : 'text-red-300'}>
            {t('calendarLoadFailed')}{' '}
            <button type="button" className="font-medium underline" onClick={() => void retry()}>{t('calendarRetry')}</button>
          </p>
        )}
        {!failed && loading && <p>{t('calendarLoading')}</p>}
        {!failed && !loading && total === 0 && <p>{t('calendarMonthEmpty')}</p>}
      </div>
      <CalendarGrid
        month={shown}
        labelledBy={titleId}
        describedBy={helpId}
        entriesByDate={entriesByDate}
        focusDate={focusDate}
        selectedDate={selectedDate}
        today={today}
        busy={loading}
        onFocusDate={goToDate}
        onOpenDay={onOpenDay}
        onOpenEntry={onOpenEntry}
        language={language}
        theme={theme}
        t={t}
      />
    </section>
  );
}

export default JournalCalendar;
