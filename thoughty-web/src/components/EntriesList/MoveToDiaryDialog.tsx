import { useId, useRef, useState, type FormEvent } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { Diary, TranslationFunction as TranslationFn } from '../../types';
import type { Language } from '../../utils/translations';
import { mutedTextClass } from '../../utils/tintedText';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import { entryDiaryId } from './entryDiary';

interface MoveToDiaryDialogProps {
    readonly entry: { readonly date: string; readonly title?: string | null; readonly diary_id?: number | null };
    readonly diaries: readonly Diary[];
    readonly isDark: boolean;
    readonly language: Language;
    /** Moves the entry; resolves `false` when it could not, and the dialog stays open to say so. */
    readonly onMove: (diaryId: number) => Promise<boolean>;
    readonly onClose: () => void;
    readonly t: TranslationFn;
}

/**
 * Asks which of the writer's other diaries an entry moves to: the diary it is in is named above the choices
 * and left out of them. Focus starts on the first diary; arrow keys move between them, Tab stays inside and
 * Escape closes it, as in every modal dialog, and focus returns to the entry's menu button.
 */
export default function MoveToDiaryDialog({ entry, diaries, isDark, language, onMove, onClose, t }: MoveToDiaryDialogProps) {
    const currentId = entryDiaryId(entry, diaries);
    const current = diaries.find((diary) => diary.id === currentId);
    const choices = diaries.filter((diary) => diary.id !== currentId);
    const [selected, setSelected] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const dialogRef = useRef<HTMLFormElement>(null);
    const firstChoiceRef = useRef<HTMLInputElement>(null);
    const titleId = useId();
    const errorId = useId();
    const name = useId();

    useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: firstChoiceRef, onClose });

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (saving) return;
        if (selected === null) {
            setError(t('moveToDiaryChooseFirst'));
            return;
        }
        setSaving(true);
        // The caller may already have closed the dialog once the entry moved; closing again changes nothing
        if (await onMove(selected)) {
            onClose();
            return;
        }
        setSaving(false);
        setError(t('entryMoveFailed'));
    };

    const subject = [formatEntryDay(entry.date, language), entry.title?.trim()].filter(Boolean).join(' · ');
    const panelClass = isDark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
    const lineClass = isDark ? 'border-gray-700' : 'border-gray-200';
    const secondaryButtonClass = isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100';
    const choiceClass = isDark
        ? 'border-gray-600 hover:bg-gray-700 has-[:checked]:border-sky-400 has-[:checked]:bg-sky-500/15'
        : 'border-gray-300 hover:bg-gray-100 has-[:checked]:border-sky-600 has-[:checked]:bg-sky-50';
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
                    <h3 id={titleId} className="text-lg font-semibold">{t('moveToDiaryTitle')}</h3>
                    <p className={`mt-1 text-sm ${mutedTextClass(isDark)}`}>{subject}</p>
                    {current && (
                        <p className={`mt-1 text-sm ${mutedTextClass(isDark)}`}>
                            {t('moveToDiaryCurrent', { diary: `${current.icon} ${current.name}`.trim() })}
                        </p>
                    )}
                </header>
                <fieldset
                    className="m-0 space-y-2 border-0 px-5 py-4 text-sm"
                    aria-describedby={error ? errorId : undefined}
                >
                    <legend className="sr-only">{t('moveToDiaryChoices')}</legend>
                    {choices.map((diary, position) => (
                        <label
                            key={diary.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${choiceClass}`}
                        >
                            <input
                                ref={position === 0 ? firstChoiceRef : undefined}
                                type="radio"
                                name={name}
                                value={diary.id}
                                checked={selected === diary.id}
                                onChange={() => {
                                    setSelected(diary.id);
                                    setError('');
                                }}
                                className="h-4 w-4 accent-sky-600"
                            />
                            {diary.color && (
                                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: diary.color }} />
                            )}
                            <span>{`${diary.icon} ${diary.name}`.trim()}</span>
                        </label>
                    ))}
                    {error && <p id={errorId} role="alert" className={errorClass}>{error}</p>}
                </fieldset>
                <footer className={`flex justify-end gap-3 border-t px-5 py-4 ${lineClass}`}>
                    <button type="button" onClick={onClose} className={`rounded border px-4 py-2 text-sm transition-colors ${secondaryButtonClass}`}>
                        {t('cancel')}
                    </button>
                    <button
                        type="submit"
                        aria-disabled={saving}
                        className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800 aria-disabled:cursor-wait aria-disabled:opacity-60"
                    >
                        {t('moveToDiaryConfirm')}
                    </button>
                </footer>
            </form>
        </div>
    );
}
