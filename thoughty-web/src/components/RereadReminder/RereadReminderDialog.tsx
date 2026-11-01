import { useId, useRef, useState, type FormEvent } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { TranslationFunction as TranslationFn } from '../../types';
import { REREAD_PRESETS, isValidRereadDay, rereadDateBounds, rereadPresetDay, type RereadPreset } from '../../utils/rereadReminder';
import type { Language } from '../../utils/translations';
import { mutedTextClass } from '../../utils/tintedText';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import { useRereadReminder } from './useRereadReminder';

interface RereadReminderDialogProps {
    readonly entry: { readonly id: number; readonly date: string; readonly title?: string | null; readonly reread_on?: string | null };
    readonly isDark: boolean;
    readonly language: Language;
    readonly onClose: () => void;
    readonly t: TranslationFn;
}

const PRESET_LABEL_KEYS: Record<RereadPreset, string> = {
    week: 'rereadInAWeek',
    month: 'rereadInAMonth',
    year: 'rereadInAYear',
};

/**
 * Asks on which day to reread an entry: in a week, a month or a year, or any day from tomorrow up to
 * fifty years ahead. That day the entry comes back in Highlights. Focus starts on the day field; Tab
 * stays inside and Escape closes it, as in every modal dialog.
 */
export default function RereadReminderDialog({ entry, isDark, language, onClose, t }: RereadReminderDialogProps) {
    const [today] = useState(() => new Date());
    const { min, max } = rereadDateBounds(today);
    const [day, setDay] = useState(() => (
        entry.reread_on && isValidRereadDay(entry.reread_on, today) ? entry.reread_on : rereadPresetDay('week', today)
    ));
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const reminders = useRereadReminder();
    const dialogRef = useRef<HTMLFormElement>(null);
    const dayRef = useRef<HTMLInputElement>(null);
    const titleId = useId();
    const dayId = useId();
    const hintId = useId();
    const errorId = useId();

    useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: dayRef, onClose });

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (saving) return;
        if (!isValidRereadDay(day, today)) {
            setError(t('rereadDateInvalid'));
            return;
        }
        setSaving(true);
        const result = await reminders.set(entry.id, day);
        setSaving(false);
        if (result.data) {
            onClose();
            return;
        }
        setError(t(result.error ?? 'rereadSaveFailed'));
    };

    const subject = [formatEntryDay(entry.date, language), entry.title?.trim()].filter(Boolean).join(' · ');
    const panelClass = isDark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
    const lineClass = isDark ? 'border-gray-700' : 'border-gray-200';
    const secondaryButtonClass = isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100';
    const fieldClass = isDark ? 'border-gray-600 bg-gray-900 text-gray-100' : 'border-gray-300 bg-white text-gray-900';
    const errorClass = isDark ? 'text-red-300' : 'text-red-700';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop: a pointer target only; keyboard users close with Escape or Cancel. */}
            <button type="button" className="absolute inset-0 cursor-default bg-black/60" onClick={onClose} aria-hidden="true" tabIndex={-1} />
            <form
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onSubmit={(event) => void submit(event)}
                noValidate
                className={`relative z-10 m-0 flex w-full max-w-md flex-col overflow-hidden rounded-lg border p-0 shadow-2xl ${panelClass}`}
            >
                <header className={`border-b px-5 py-4 ${lineClass}`}>
                    <h3 id={titleId} className="text-lg font-semibold">{t('rereadDialogTitle')}</h3>
                    <p className={`mt-1 text-sm ${mutedTextClass(isDark)}`}>{subject}</p>
                </header>
                <div className="space-y-4 px-5 py-4 text-sm">
                    <div role="group" aria-label={t('rereadPresets')} className="flex flex-wrap gap-2">
                        {REREAD_PRESETS.map((preset) => {
                            const presetDay = rereadPresetDay(preset, today);
                            return (
                                <button
                                    key={preset}
                                    type="button"
                                    aria-pressed={day === presetDay}
                                    onClick={() => {
                                        setDay(presetDay);
                                        setError('');
                                    }}
                                    className={`rounded-full border px-3 py-1.5 transition-colors aria-pressed:border-sky-500 aria-pressed:bg-sky-500/15 ${secondaryButtonClass}`}
                                >
                                    {t(PRESET_LABEL_KEYS[preset])}
                                </button>
                            );
                        })}
                    </div>
                    <div className="space-y-1">
                        <label htmlFor={dayId} className="block font-medium">{t('rereadDateLabel')}</label>
                        <input
                            ref={dayRef}
                            id={dayId}
                            type="date"
                            value={day}
                            min={min}
                            max={max}
                            required
                            onChange={(event) => {
                                setDay(event.target.value);
                                setError('');
                            }}
                            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                            aria-invalid={error ? true : undefined}
                            className={`w-full rounded border px-3 py-2 ${fieldClass}`}
                        />
                    </div>
                    <p id={hintId} className={mutedTextClass(isDark)}>{t('rereadDialogHint')}</p>
                    {error && <p id={errorId} role="alert" className={errorClass}>{error}</p>}
                </div>
                <footer className={`flex justify-end gap-3 border-t px-5 py-4 ${lineClass}`}>
                    <button type="button" onClick={onClose} className={`rounded border px-4 py-2 text-sm transition-colors ${secondaryButtonClass}`}>
                        {t('cancel')}
                    </button>
                    <button
                        type="submit"
                        aria-disabled={saving}
                        className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600 aria-disabled:cursor-wait aria-disabled:opacity-60"
                    >
                        {t('rereadSave')}
                    </button>
                </footer>
            </form>
        </div>
    );
}
