import { currentTimeOfDay } from '../../utils/entryTime';

interface EntryTimeFieldProps {
    /** `HH:MM`, or an empty string for an entry without a time. */
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly id: string;
    readonly inputClass: string;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** Optional time of day with a "Now" shortcut; empty by default. */
export default function EntryTimeField({ value, onChange, id, inputClass, theme, t }: EntryTimeFieldProps) {
    const buttonClass = `h-10 shrink-0 rounded-lg border px-3 text-sm transition-colors ${theme === 'light'
        ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
        : 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
        }`;

    return (
        <div className="flex items-center gap-2">
            <label htmlFor={id} className="sr-only">{t('entryTimeLabel')}</label>
            <input
                id={id}
                type="time"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={`${inputClass} w-32`}
                title={t('entryTimeLabel')}
            />
            {value ? (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    className={buttonClass}
                    aria-label={t('entryTimeClear')}
                    title={t('entryTimeClear')}
                >
                    <span aria-hidden="true">&times;</span>
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => onChange(currentTimeOfDay())}
                    className={buttonClass}
                    title={t('entryTimeNowLabel')}
                >
                    {t('entryTimeNow')}
                </button>
            )}
        </div>
    );
}
