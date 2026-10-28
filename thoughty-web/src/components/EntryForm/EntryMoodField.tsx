import { useState } from 'react';
import {
    CURATED_FEELINGS,
    MAX_FEELINGS,
    MAX_FEELING_LENGTH,
    MOOD_LEVELS,
    addFeeling,
    feelingLabel,
    moodEmoji,
    moodLabelKey,
    toggleFeeling,
} from '../../utils/entryMood';
import { mutedTextClass } from '../../utils/tintedText';

interface EntryMoodFieldProps {
    /** Prefix for the field's ids; it must not start with `entry-`, which entry cards use. */
    readonly id: string;
    /** From 1 to 5, or null for an entry without a mood. */
    readonly mood: number | null;
    readonly onMoodChange: (mood: number | null) => void;
    readonly feelings: string[];
    readonly onFeelingsChange: (feelings: string[]) => void;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Optional mood check-in: five labelled levels as native radio buttons, then feeling words picked
 * from a curated list or typed. Every level shows its label, so the emoji is decoration only.
 */
export default function EntryMoodField({ id, mood, onMoodChange, feelings, onFeelingsChange, theme, t }: EntryMoodFieldProps) {
    const isLight = theme === 'light';
    const [showFeelings, setShowFeelings] = useState(feelings.length > 0);
    const [customFeeling, setCustomFeeling] = useState('');
    const customFeelings = feelings.filter((feeling) => !(CURATED_FEELINGS as readonly string[]).includes(feeling));
    const atLimit = feelings.length >= MAX_FEELINGS;
    const feelingsOpen = showFeelings || feelings.length > 0;

    const levelClass = (checked: boolean) => `inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-500 ${checked
        ? `border-blue-500 bg-blue-500/15 font-semibold ${isLight ? 'text-blue-700' : 'text-blue-200'}`
        : isLight ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100' : 'border-gray-600 bg-gray-900 text-gray-200 hover:bg-gray-700'
        }`;
    const chipClass = (pressed: boolean) => `rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${pressed
        ? `border-blue-500 bg-blue-500/15 font-semibold ${isLight ? 'text-blue-700' : 'text-blue-200'}`
        : isLight ? 'border-gray-300 text-gray-700 hover:bg-gray-100' : 'border-gray-600 text-gray-300 hover:bg-gray-700'
        }`;
    const quietButtonClass = `rounded-lg px-2 py-1 text-xs underline-offset-2 hover:underline ${isLight ? 'text-gray-600' : 'text-gray-300'}`;

    const addCustomFeeling = () => {
        const next = addFeeling(feelings, customFeeling);
        onFeelingsChange(next);
        setCustomFeeling('');
    };

    return (
        <div className="space-y-2">
            <fieldset className="min-w-0">
                <legend className={`mb-1.5 text-sm font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>{t('moodLegend')}</legend>
                <div className="flex flex-wrap items-center gap-2">
                    {MOOD_LEVELS.map((level) => (
                        <label key={level} htmlFor={`${id}-${level}`} className={levelClass(mood === level)}>
                            <input
                                id={`${id}-${level}`}
                                type="radio"
                                name={id}
                                value={level}
                                checked={mood === level}
                                onChange={() => onMoodChange(level)}
                                className="sr-only"
                            />
                            <span aria-hidden="true">{moodEmoji(level)}</span>
                            <span>{t(moodLabelKey(level))}</span>
                        </label>
                    ))}
                    {mood !== null && (
                        <button type="button" onClick={() => onMoodChange(null)} className={quietButtonClass}>
                            {t('moodClear')}
                        </button>
                    )}
                    {feelings.length === 0 && (
                        <button
                            type="button"
                            onClick={() => setShowFeelings((open) => !open)}
                            aria-expanded={feelingsOpen}
                            aria-controls={`${id}-feelings`}
                            className={quietButtonClass}
                        >
                            {t('feelingsLegend')}
                        </button>
                    )}
                </div>
            </fieldset>
            {feelingsOpen && (
                <fieldset id={`${id}-feelings`} className="min-w-0">
                    <legend className="sr-only">{t('feelingsLegend')}</legend>
                    <div className="flex flex-wrap gap-1.5">
                        {CURATED_FEELINGS.map((feeling) => {
                            const pressed = feelings.includes(feeling);
                            return (
                                <button
                                    key={feeling}
                                    type="button"
                                    aria-pressed={pressed}
                                    disabled={!pressed && atLimit}
                                    onClick={() => onFeelingsChange(toggleFeeling(feelings, feeling))}
                                    className={chipClass(pressed)}
                                >
                                    {feelingLabel(feeling, t)}
                                </button>
                            );
                        })}
                        {customFeelings.map((feeling) => (
                            <button
                                key={feeling}
                                type="button"
                                onClick={() => onFeelingsChange(toggleFeeling(feelings, feeling))}
                                aria-label={t('feelingsRemove', { feeling })}
                                className={chipClass(true)}
                            >
                                {feeling} <span aria-hidden="true">&times;</span>
                            </button>
                        ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label htmlFor={`${id}-custom`} className="sr-only">{t('feelingsCustomLabel')}</label>
                        <input
                            id={`${id}-custom`}
                            type="text"
                            value={customFeeling}
                            maxLength={MAX_FEELING_LENGTH}
                            disabled={atLimit}
                            placeholder={t('feelingsCustomPlaceholder')}
                            onChange={(event) => setCustomFeeling(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    // Enter adds the feeling instead of submitting the entry
                                    event.preventDefault();
                                    addCustomFeeling();
                                }
                            }}
                            className={`h-8 w-48 rounded-lg border px-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${isLight ? 'border-gray-300 bg-gray-50 text-gray-900' : 'border-gray-700 bg-gray-900 text-gray-100'}`}
                        />
                        <button
                            type="button"
                            onClick={addCustomFeeling}
                            disabled={atLimit || !customFeeling.trim()}
                            className={chipClass(false)}
                        >
                            {t('feelingsAdd')}
                        </button>
                        <span className={`text-xs ${mutedTextClass(!isLight)}`}>{t('feelingsLimit', { count: MAX_FEELINGS })}</span>
                    </div>
                </fieldset>
            )}
        </div>
    );
}
