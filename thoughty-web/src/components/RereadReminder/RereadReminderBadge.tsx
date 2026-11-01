import { useState } from 'react';
import type { TranslationFunction as TranslationFn } from '../../types';
import type { Language } from '../../utils/translations';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import RereadIcon from './RereadIcon';
import { useRereadReminder } from './useRereadReminder';

interface RereadReminderBadgeProps {
    readonly entryId: number;
    /** The day the writer asked to reread the entry on (YYYY-MM-DD). */
    readonly rereadOn: string;
    readonly isDark: boolean;
    readonly language: Language;
    readonly t: TranslationFn;
}

/** The small note on an entry card saying when the writer asked to reread it, with a button that removes the reminder. */
export default function RereadReminderBadge({ entryId, rereadOn, isDark, language, t }: RereadReminderBadgeProps) {
    const reminders = useRereadReminder();
    const [removing, setRemoving] = useState(false);
    const [error, setError] = useState('');
    const day = formatEntryDay(rereadOn, language);

    const remove = async () => {
        if (removing) return;
        setRemoving(true);
        setError('');
        const result = await reminders.clear(entryId);
        setRemoving(false);
        if (!result.data) setError(t(result.error ?? 'rereadRemoveFailed'));
    };

    const badgeClass = isDark ? 'border-teal-700 bg-teal-900/40 text-teal-200' : 'border-teal-300 bg-teal-50 text-teal-800';
    const removeClass = isDark ? 'hover:bg-teal-800/60' : 'hover:bg-teal-100';

    return (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-2 pr-0.5 font-medium ${badgeClass}`}>
                <RereadIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{t('rereadIndicator', { date: day })}</span>
                <button
                    type="button"
                    onClick={() => void remove()}
                    aria-disabled={removing}
                    aria-label={t('rereadRemove', { date: day })}
                    title={t('rereadRemove', { date: day })}
                    className={`rounded-full p-1 transition-colors aria-disabled:cursor-wait ${removeClass}`}
                >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                        <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
            </span>
            {error && <span role="alert" className={isDark ? 'text-red-300' : 'text-red-700'}>{error}</span>}
        </div>
    );
}
