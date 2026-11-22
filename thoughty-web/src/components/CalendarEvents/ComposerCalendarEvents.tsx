import { useId } from 'react';
import type { TranslationFunction } from '../../types';
import type { CalendarEvent } from '../../services/api';
import { formatEntryDate } from '../../utils/entryDate';
import { mutedTextClass, tintedTextClass } from '../../utils/tintedText';
import { browserTimeZone } from '../../utils/timeZone';
import type { Language } from '../../utils/translations';
import { useCalendarDay } from './useCalendarEvents';

interface ComposerCalendarEventsProps {
    /** The composer's day. */
    readonly date: Date;
    /** Puts a writing prompt about the event in the entry. */
    readonly onWriteAbout: (prompt: string) => void;
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

/**
 * The imported calendar's events on the composer's day, a repeating one marked and at its time that
 * day, each with **Write about it**, which adds a question about the event to the entry. Nothing shows
 * on a day without events.
 */
export default function ComposerCalendarEvents({ date, onWriteAbout, language, theme, t }: ComposerCalendarEventsProps) {
    const events = useCalendarDay(formatEntryDate(date));
    const headingId = useId();
    if (events.length === 0) return null;
    const muted = mutedTextClass(theme !== 'light');

    return (
        <section aria-labelledby={headingId} className="composer-calendar-events rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-3">
            <h3 id={headingId} className={`mb-2 text-xs font-semibold uppercase tracking-wide ${tintedTextClass('sky', theme)}`}>
                {t('calendarDayEvents')}
            </h3>
            <ul className="space-y-1.5">
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
                            <button
                                type="button"
                                onClick={() => onWriteAbout(t('calendarEventPrompt', { summary }))}
                                aria-label={t('calendarWriteAboutLabel', { summary })}
                                className={`ml-auto rounded-md border border-sky-500/40 px-2 py-0.5 text-xs font-medium transition-colors hover:bg-sky-500/20 ${tintedTextClass('sky', theme)}`}
                            >
                                {t('calendarWriteAbout')}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
