import type { ReactNode } from 'react';
import type { TranslationFunction } from '../../types';
import type { CalendarEvent } from '../../services/api';
import { mutedTextClass } from '../../utils/tintedText';
import { browserTimeZone } from '../../utils/timeZone';
import type { Language } from '../../utils/translations';

interface CalendarEventListProps {
    readonly events: readonly CalendarEvent[];
    /** A control after each event, given the event and the title it is shown with. */
    readonly action?: (event: CalendarEvent, summary: string) => ReactNode;
    readonly id?: string;
    readonly language: Language;
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
}

/** "All day", or the event's hours in the browser's time zone ("19:30 – 22:00"). */
function eventTime(event: CalendarEvent, language: Language, t: TranslationFunction): string {
    if (event.allDay || !event.startsAt) return t('calendarAllDay');
    const format = new Intl.DateTimeFormat(language, { hour: 'numeric', minute: '2-digit', timeZone: browserTimeZone() });
    const start = new Date(event.startsAt);
    const end = event.endsAt ? new Date(event.endsAt) : start;
    return end > start ? format.formatRange(start, end) : format.format(start);
}

/** A day's imported events: each one's hours (or all day), title, whether it repeats and where, blurred with the privacy blur. */
export default function CalendarEventList({ events, action, id, language, theme, t }: CalendarEventListProps) {
    const muted = mutedTextClass(theme !== 'light');
    return (
        <ul id={id} className="space-y-1.5">
            {events.map((event) => {
                const summary = event.summary || t('calendarUntitled');
                return (
                    <li key={event.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span className={`tabular-nums ${muted}`}>{eventTime(event, language, t)}</span>
                        <span className="privacy-text font-medium">{summary}</span>
                        {event.repeats && (
                            <span
                                role="img"
                                aria-label={t('calendarRepeats')}
                                title={t('calendarRepeats')}
                                className={`codicon codicon-sync text-xs ${muted}`}
                            />
                        )}
                        {event.location && <span className={`privacy-text ${muted}`}>{event.location}</span>}
                        {action?.(event, summary)}
                    </li>
                );
            })}
        </ul>
    );
}
