import { useId, useState } from 'react';
import type { TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { tintedTextClass } from '../../utils/tintedText';
import type { Language } from '../../utils/translations';
import CalendarEventList from './CalendarEventList';
import { useCalendarDays } from './useCalendarEvents';

/** How many of a day's events show before **Show more**. */
const SHOWN_AT_FIRST = 3;

interface JournalDayEventsProps {
    /** The day (`YYYY-MM-DD`) whose events to show. */
    readonly date: string;
    /** Every day the journal shows, whose events are asked for together. */
    readonly days: readonly string[];
    readonly language: Language;
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
}

/**
 * The imported calendar's events on a day of the journal, under the day's heading: the first three,
 * with **Show more** for the rest. The events of every day shown come in one request; nothing shows
 * on a day without events.
 */
export default function JournalDayEvents({ date, days, language, theme, t }: JournalDayEventsProps) {
    const events = useCalendarDays(days).get(date);
    const [expanded, setExpanded] = useState(false);
    const headingId = useId();
    const listId = useId();
    if (!events?.length) return null;
    const shown = expanded ? events : events.slice(0, SHOWN_AT_FIRST);
    const tint = tintedTextClass('sky', theme);

    return (
        <section aria-labelledby={headingId} className="journal-day-events mt-3 rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-2.5">
            <h3 id={headingId} className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${tint}`}>
                {t('calendarDayEvents')}
            </h3>
            <CalendarEventList id={listId} events={shown} language={language} theme={theme} t={t} />
            {events.length > SHOWN_AT_FIRST && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={listId}
                    onClick={() => setExpanded((current) => !current)}
                    className={`mt-1.5 rounded-md text-xs font-medium underline-offset-2 hover:underline ${tint}`}
                >
                    {expanded ? t('calendarShowFewer') : pluralPhrase(t, 'calendarShowMore', events.length - SHOWN_AT_FIRST, language)}
                </button>
            )}
        </section>
    );
}
