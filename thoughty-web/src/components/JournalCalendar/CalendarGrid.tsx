import { useEffect, useRef, type KeyboardEvent } from 'react';

import type { EntryCalendarItem } from '../../services/api';
import type { Theme, TranslationFunction } from '../../types';
import { buildCalendarWeeks, moveCalendarFocus, type CalendarMonth } from '../../utils/calendarMonth';
import { weekdayName } from '../../utils/calendarNames';
import { isMoodLevel, moodEmoji, moodLabelKey } from '../../utils/entryMood';
import { pluralPhrase } from '../../utils/pluralPhrase';
import type { Language } from '../../utils/translations';

/** Entries a day shows by name on wide screens; the rest are counted. */
const ENTRIES_PER_DAY = 3;
/** Monday first: weekday numbers as `weekdayName` takes them (0 = Sunday). */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;

interface CalendarGridProps {
  readonly month: CalendarMonth;
  readonly labelledBy: string;
  readonly describedBy: string;
  readonly entriesByDate: ReadonlyMap<string, readonly EntryCalendarItem[]>;
  /** The day that takes the keyboard focus (one tab stop for the whole grid). */
  readonly focusDate: string;
  /** The journal's date filter, shown as the selected day. */
  readonly selectedDate: string | null;
  readonly today: string;
  readonly busy: boolean;
  readonly onFocusDate: (date: string) => void;
  readonly onOpenDay: (date: string) => void;
  readonly onOpenEntry: (entry: EntryCalendarItem) => void;
  readonly language: Language;
  readonly theme: Theme;
  readonly t: TranslationFunction;
}

function longDate(date: string, language: Language): string {
  const utc = new Date(Date.UTC(2000, Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))));
  utc.setUTCFullYear(Number(date.slice(0, 4)));
  return new Intl.DateTimeFormat(language, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(utc);
}

/** What an entry is called in the grid: its title, else the start of its text. */
function calendarEntryName(entry: EntryCalendarItem, t: TranslationFunction): string {
  const name = entry.title || entry.snippet || t('calendarUntitledEntry', { index: entry.index });
  return entry.time_of_day ? `${entry.time_of_day} ${name}` : name;
}

function entryLabel(entry: EntryCalendarItem, t: TranslationFunction): string {
  const name = calendarEntryName(entry, t);
  const withMood = isMoodLevel(entry.mood)
    ? t('calendarEntryMood', { entry: name, mood: t(moodLabelKey(entry.mood)) })
    : name;
  return t('calendarOpenEntry', { entry: withMood });
}

function dayClass(theme: Theme, selected: boolean): string {
  const base = 'relative h-16 cursor-pointer border p-1 align-top outline-none transition-colors focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500 sm:h-28 sm:p-1.5';
  const colors = theme === 'light'
    ? 'border-gray-200 bg-white hover:bg-gray-50'
    : 'border-gray-700 bg-gray-900/40 hover:bg-gray-800';
  return `${base} ${colors}${selected ? ' ring-2 ring-inset ring-blue-500' : ''}`;
}

/**
 * The month as a grid of weeks from Monday, following the date picker grid pattern: one tab stop,
 * arrows by day and week, Home and End within the week, Page Up and Page Down by month (with Shift,
 * by year), and Enter or Space to show the day in the list. Each day names up to three entries on wide
 * screens and shows dots on phones; a click on an entry opens it, a click elsewhere on the day shows the day.
 */
function CalendarGrid({
  month,
  labelledBy,
  describedBy,
  entriesByDate,
  focusDate,
  selectedDate,
  today,
  busy,
  onFocusDate,
  onOpenDay,
  onOpenEntry,
  language,
  theme,
  t,
}: CalendarGridProps) {
  const gridRef = useRef<HTMLTableElement>(null);
  const focusTarget = useRef<string | null>(null);
  const isLight = theme === 'light';

  // The day a key moved to takes the focus once it is drawn, which can be a render later when the month changes
  useEffect(() => {
    if (focusTarget.current !== focusDate) return;
    focusTarget.current = null;
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [focusDate]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const cellDate = event.target instanceof HTMLElement ? event.target.dataset['date'] : undefined;
    if (!cellDate || event.altKey || event.ctrlKey || event.metaKey) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpenDay(cellDate);
      return;
    }

    const next = moveCalendarFocus(cellDate, event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    focusTarget.current = next;
    onFocusDate(next);
  };

  return (
    <table
      ref={gridRef}
      role="grid"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-busy={busy}
      className="journal-calendar-grid w-full table-fixed border-collapse"
      onKeyDown={handleKeyDown}
    >
      <thead>
        <tr>
          {WEEKDAYS.map((weekday) => (
            <th
              key={weekday}
              scope="col"
              className={`pb-2 text-center text-xs font-semibold uppercase ${isLight ? 'text-gray-600' : 'text-gray-400'}`}
            >
              <span aria-hidden="true">{weekdayName(weekday, language, 'short')}</span>
              <span className="sr-only">{weekdayName(weekday, language)}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {buildCalendarWeeks(month).map((week) => (
          <tr key={week.find(Boolean)}>
            {week.map((date, position) => {
              if (date === null) {
                return <td key={`blank-${position}`} role="gridcell" className={`border ${isLight ? 'border-gray-100' : 'border-gray-800'}`} />;
              }
              const entries = entriesByDate.get(date) ?? [];
              const isToday = date === today;
              const dayLabel = t('calendarDayLabel', {
                date: longDate(date, language),
                count: pluralPhrase(t, 'calendarEntryCount', entries.length, language),
              });
              const hidden = entries.length - ENTRIES_PER_DAY;

              return (
                <td
                  key={date}
                  role="gridcell"
                  data-date={date}
                  tabIndex={date === focusDate ? 0 : -1}
                  aria-selected={date === selectedDate}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={isToday ? t('calendarDayToday', { label: dayLabel }) : dayLabel}
                  className={dayClass(theme, date === selectedDate)}
                  onClick={() => onOpenDay(date)}
                >
                  <span
                    aria-hidden="true"
                    className={`mb-1 inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold ${isToday
                      ? 'bg-blue-600 text-white'
                      : isLight ? 'text-gray-700' : 'text-gray-300'}`}
                  >
                    {Number(date.slice(8, 10))}
                  </span>
                  {entries.length > 0 && (
                    <>
                      <ul className="hidden space-y-0.5 sm:block">
                        {entries.slice(0, ENTRIES_PER_DAY).map((entry) => (
                          <li key={entry.id}>
                            <button
                              type="button"
                              tabIndex={-1}
                              aria-label={entryLabel(entry, t)}
                              title={calendarEntryName(entry, t)}
                              className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-xs ${isLight
                                ? 'bg-blue-50 text-blue-900 hover:bg-blue-100'
                                : 'bg-blue-500/15 text-blue-100 hover:bg-blue-500/25'}`}
                              onClick={(event) => { event.stopPropagation(); onOpenEntry(entry); }}
                            >
                              <span className="truncate">{calendarEntryName(entry, t)}</span>
                              {isMoodLevel(entry.mood) && <span aria-hidden="true" className="shrink-0">{moodEmoji(entry.mood)}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                      {hidden > 0 && (
                        <span aria-hidden="true" className={`hidden px-1 text-xs font-medium sm:block ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                          {t('calendarMoreEntries', { count: hidden })}
                        </span>
                      )}
                      <span aria-hidden="true" className="flex flex-wrap gap-1 px-1 sm:hidden">
                        {entries.slice(0, ENTRIES_PER_DAY).map((entry) => (
                          <span key={entry.id} className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        ))}
                        {hidden > 0 && <span className={`text-[0.625rem] leading-none ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>+</span>}
                      </span>
                    </>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default CalendarGrid;
