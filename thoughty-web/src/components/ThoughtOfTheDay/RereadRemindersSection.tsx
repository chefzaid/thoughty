import { useState } from 'react';
import HighlightCard from './HighlightCard';
import './RereadRemindersSection.css';
import type { components } from '../../generated/openapi';
import type { Language } from '../../utils/translations';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import RereadIcon from '../RereadReminder/RereadIcon';
import { useRereadReminder } from '../RereadReminder/useRereadReminder';

type Entry = components['schemas']['EntryResponseDto'];

interface RereadRemindersSectionProps {
    readonly entries: Entry[];
    readonly language: Language;
    readonly formatDate: (dateStr: string) => string;
    readonly onSelectEntry: (entry: Entry) => void;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * The entries the writer asked to reread, due today or earlier, in Highlights after the capsules
 * opened lately. Each stays until **Done rereading**, which takes it off the list.
 */
export default function RereadRemindersSection({ entries, language, formatDate, onSelectEntry, t }: RereadRemindersSectionProps) {
    const reminders = useRereadReminder();
    const [doneIds, setDoneIds] = useState<ReadonlySet<number>>(new Set());
    const [pendingId, setPendingId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [announcement, setAnnouncement] = useState('');
    const shown = entries.filter((entry) => !doneIds.has(entry.id));

    const markDone = async (entry: Entry) => {
        if (pendingId !== null) return;
        setPendingId(entry.id);
        setError('');
        const result = await reminders.clear(entry.id);
        setPendingId(null);
        if (!result.data) {
            setError(t(result.error ?? 'rereadRemoveFailed'));
            return;
        }
        setDoneIds((current) => new Set(current).add(entry.id));
        setAnnouncement(t('rereadDoneAnnouncement', { date: formatEntryDay(entry.date, language) }));
    };

    return (
        <div className="highlight-section reread-reminders">
            <p role="status" className="sr-only">{announcement}</p>
            {shown.length > 0 && (
                <>
                    <h3 className="section-title">
                        <RereadIcon className="reread-section-icon" />
                        {t('rereadHighlightsTitle')}
                    </h3>
                    {error && <p role="alert" className="reread-error">{error}</p>}
                    {shown.map((entry) => (
                        <HighlightCard
                            key={entry.id}
                            entry={entry}
                            formattedDate={formatDate(entry.date)}
                            maxLength={300}
                            onOpen={() => onSelectEntry(entry)}
                        >
                            <div className="reread-footer">
                                {entry.reread_on && (
                                    <p className="reread-meta">{t('rereadAskedFor', { date: formatEntryDay(entry.reread_on, language) })}</p>
                                )}
                                <button
                                    type="button"
                                    className="reread-done"
                                    aria-disabled={pendingId === entry.id}
                                    aria-label={t('rereadDoneFor', { date: formatEntryDay(entry.date, language) })}
                                    onClick={() => void markDone(entry)}
                                >
                                    {t('rereadDone')}
                                </button>
                            </div>
                        </HighlightCard>
                    ))}
                </>
            )}
        </div>
    );
}
