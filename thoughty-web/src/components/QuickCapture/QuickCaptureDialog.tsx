import { useEffect, useId, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';

import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { TranslationFunction } from '../../types';
import { isModalDialogOpen, isQuickCaptureShortcut } from './quickCaptureShortcut';
import type { QuickCaptureState } from './useQuickCapture';

interface QuickCaptureDialogProps {
    readonly quickCapture: QuickCaptureState;
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
}

/**
 * The quick capture box and its shortcut. The shortcut opens it from anywhere in the signed-in app, also
 * while typing, but not over focus mode or another dialog. It is a modal dialog: focus starts in its one
 * labelled field, Tab stays inside, Enter saves, Escape closes it and focus goes back to where it was.
 */
function QuickCaptureDialog({ quickCapture, theme, t }: QuickCaptureDialogProps) {
    const { isOpen, open, close, text, setText, saving, error, save, openInFull } = quickCapture;
    const dialogRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    const inputId = useId();
    const errorId = useId();
    const isLight = theme === 'light';

    useDialogFocus({ isOpen, dialogRef, initialFocusRef: inputRef, onClose: close });

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent): void => {
            if (!isQuickCaptureShortcut(event)) {
                return;
            }
            if (isOpen) {
                event.preventDefault();
                inputRef.current?.focus();
                return;
            }
            if (event.defaultPrevented || isModalDialogOpen()) {
                return;
            }
            event.preventDefault();
            if (!event.repeat) {
                open();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, open]);

    // A failed save hands the field back, with its text, for another try
    useEffect(() => {
        if (error) {
            inputRef.current?.focus();
        }
    }, [error]);

    if (!isOpen) {
        return null;
    }

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void save();
    };

    const secondaryButton = `px-4 py-2 rounded-lg font-medium transition-colors ${
        isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
    }`;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            {/* Backdrop: a pointer target only; keyboard users close with Escape or the Cancel button. */}
            <button
                type="button"
                className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
                onClick={close}
                aria-hidden="true"
                tabIndex={-1}
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                className={`relative z-10 w-full max-w-lg mx-4 p-5 rounded-xl shadow-2xl border ${
                    isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
                }`}
            >
                <h2 id={titleId} className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
                    {t('quickCapture')}
                </h2>
                <p id={descriptionId} className={`mt-1 mb-4 text-sm ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
                    {t('quickCaptureDescription')}
                </p>
                <form noValidate onSubmit={handleSubmit}>
                    <label htmlFor={inputId} className={`block mb-1 text-sm font-medium ${isLight ? 'text-gray-700' : 'text-gray-200'}`}>
                        {t('whatsOnYourMind')}
                    </label>
                    <input
                        ref={inputRef}
                        id={inputId}
                        type="text"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        aria-invalid={error !== ''}
                        aria-describedby={error ? errorId : undefined}
                        autoComplete="off"
                        className={`privacy-text w-full border rounded-lg px-3 h-11 focus:ring-1 focus:ring-blue-500 outline-none ${
                            isLight ? 'bg-gray-50 border-gray-300 text-gray-900' : 'bg-gray-900 border-gray-600 text-gray-100'
                        } ${error ? 'border-red-500' : ''}`}
                    />
                    {error && (
                        <p id={errorId} role="alert" className={`mt-2 text-sm ${isLight ? 'text-red-700' : 'text-red-300'}`}>
                            {t(error)}
                        </p>
                    )}
                    <div className="mt-5 flex flex-wrap justify-end gap-3">
                        <button type="button" onClick={close} className={secondaryButton}>
                            {t('cancel')}
                        </button>
                        <button type="button" onClick={openInFull} className={secondaryButton}>
                            {t('quickCaptureOpenInFull')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {saving ? t('quickCaptureSaving') : t('save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body,
    );
}

export default QuickCaptureDialog;
