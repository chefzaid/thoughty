import { useId, useRef, useState, type FormEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { TranslationFunction } from '../../types';

/** A picture the writer can place: one already stored (by ID) or one picked and uploaded on save (by name). */
export interface InlineImageCandidate {
    readonly key: string;
    readonly name: string;
    readonly target: number | string;
}

interface InsertImageDialogProps {
    readonly candidates: readonly InlineImageCandidate[];
    /** The picture chosen from its card, or null to choose in the dialog. */
    readonly initialKey: string | null;
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
    readonly onCancel: () => void;
    readonly onInsert: (candidate: InlineImageCandidate, alt: string) => void;
    /** Where focus goes when the dialog closes: the writing field. */
    readonly returnFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Asks which picture to place and its alt text, in a modal dialog: focus starts on the picture list
 * (or the alt text field when the picture is already chosen), Tab stays inside, and Escape cancels.
 */
function InsertImageDialog({ candidates, initialKey, theme, t, onCancel, onInsert, returnFocusRef }: InsertImageDialogProps) {
    const [selectedKey, setSelectedKey] = useState(initialKey ?? candidates[0]?.key ?? '');
    const [alt, setAlt] = useState('');
    const dialogRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<HTMLSelectElement>(null);
    const altRef = useRef<HTMLInputElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    const selectId = useId();
    const altId = useId();
    const hintId = useId();
    const isLight = theme === 'light';
    const selected = candidates.find((candidate) => candidate.key === selectedKey);
    const fieldClass = `w-full border rounded-lg px-3 h-10 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${
        isLight ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-700 text-gray-100'
    }`;
    const labelClass = `block mb-1 text-sm font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`;

    let initialFocusRef: RefObject<HTMLElement | null> = initialKey || candidates.length < 2 ? altRef : selectRef;
    if (candidates.length === 0) initialFocusRef = cancelRef;
    useDialogFocus({
        isOpen: true,
        dialogRef,
        initialFocusRef,
        onClose: onCancel,
        returnFocusRef,
    });

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // Portaled out of the entry form, but React still bubbles submit to it
        event.stopPropagation();
        if (selected) onInsert(selected, alt);
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
                onClick={onCancel}
                aria-hidden="true"
                tabIndex={-1}
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className={`relative z-10 w-full max-w-md mx-4 p-6 rounded-xl shadow-2xl border ${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}
            >
                <h3 id={titleId} className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
                    {t('insertImageTitle')}
                </h3>
                <p id={descriptionId} className={`mb-4 text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                    {candidates.length === 0 ? t('insertImageNone') : t('insertImageDescription')}
                </p>
                <form noValidate onSubmit={handleSubmit} className="space-y-4">
                    {candidates.length > 0 && (
                        <>
                            <div>
                                <label htmlFor={selectId} className={labelClass}>{t('insertImageChoose')}</label>
                                <select
                                    ref={selectRef}
                                    id={selectId}
                                    value={selectedKey}
                                    onChange={(event) => setSelectedKey(event.target.value)}
                                    className={fieldClass}
                                >
                                    {candidates.map((candidate) => (
                                        <option key={candidate.key} value={candidate.key}>{candidate.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor={altId} className={labelClass}>{t('insertImageAlt')}</label>
                                <input
                                    ref={altRef}
                                    id={altId}
                                    type="text"
                                    value={alt}
                                    onChange={(event) => setAlt(event.target.value)}
                                    maxLength={300}
                                    autoComplete="off"
                                    aria-describedby={hintId}
                                    className={fieldClass}
                                />
                                <p id={hintId} className={`mt-1 text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{t('insertImageAltHint')}</p>
                            </div>
                        </>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            ref={cancelRef}
                            type="button"
                            onClick={onCancel}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                        >
                            {t('cancel')}
                        </button>
                        {candidates.length > 0 && (
                            <button type="submit" className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-medium transition-colors">
                                {t('insertImageConfirm')}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}

export default InsertImageDialog;
