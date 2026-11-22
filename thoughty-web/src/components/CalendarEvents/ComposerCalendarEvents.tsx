import { useId } from 'react';
import type { TranslationFunction } from '../../types';
import { formatEntryDate } from '../../utils/entryDate';
import { tintedTextClass } from '../../utils/tintedText';
import type { Language } from '../../utils/translations';
import CalendarEventList from './CalendarEventList';
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

/**
 * The imported calendar's events on the composer's day, a repeating one marked and at its time that
 * day, each with **Write about it**, which adds a question about the event to the entry. Nothing shows
 * on a day without events.
 */
export default function ComposerCalendarEvents({ date, onWriteAbout, language, theme, t }: ComposerCalendarEventsProps) {
    const events = useCalendarDay(formatEntryDate(date));
    const headingId = useId();
    if (events.length === 0) return null;

    return (
        <section aria-labelledby={headingId} className="composer-calendar-events rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-3">
            <h3 id={headingId} className={`mb-2 text-xs font-semibold uppercase tracking-wide ${tintedTextClass('sky', theme)}`}>
                {t('calendarDayEvents')}
            </h3>
            <CalendarEventList
                events={events}
                language={language}
                theme={theme}
                t={t}
                action={(_event, summary) => (
                    <button
                        type="button"
                        onClick={() => onWriteAbout(t('calendarEventPrompt', { summary }))}
                        aria-label={t('calendarWriteAboutLabel', { summary })}
                        className={`ml-auto rounded-md border border-sky-500/40 px-2 py-0.5 text-xs font-medium transition-colors hover:bg-sky-500/20 ${tintedTextClass('sky', theme)}`}
                    >
                        {t('calendarWriteAbout')}
                    </button>
                )}
            />
        </section>
    );
}
