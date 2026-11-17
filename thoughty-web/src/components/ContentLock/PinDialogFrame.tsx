import { useId, useRef, type FormEvent, type ReactNode, type RefObject } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { mutedTextClass } from '../../utils/tintedText';

interface PinDialogFrameProps {
    readonly title: string;
    readonly description: string;
    readonly isDark: boolean;
    readonly submitLabel: string;
    readonly cancelLabel: string;
    readonly busy: boolean;
    readonly canSubmit: boolean;
    readonly initialFocusRef: RefObject<HTMLInputElement | null>;
    readonly onSubmit: () => void;
    readonly onClose: () => void;
    readonly children: ReactNode;
}

/** The modal form the PIN dialogs share: focus starts in the PIN field, Tab stays inside and Escape cancels. */
export default function PinDialogFrame({
    title, description, isDark, submitLabel, cancelLabel, busy, canSubmit, initialFocusRef, onSubmit, onClose, children,
}: PinDialogFrameProps) {
    const dialogRef = useRef<HTMLFormElement>(null);
    const titleId = useId();
    const descriptionId = useId();
    useDialogFocus({ isOpen: true, dialogRef, initialFocusRef, onClose });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        if (!busy && canSubmit) onSubmit();
    };
    const panelClass = isDark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
    const lineClass = isDark ? 'border-gray-700' : 'border-gray-200';
    const secondaryButtonClass = isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop: a pointer target only; keyboard users close with Escape or Cancel. */}
            <button type="button" className="absolute inset-0 cursor-default bg-black/60" onClick={onClose} aria-hidden="true" tabIndex={-1} />
            <form
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                onSubmit={submit}
                noValidate
                className={`relative z-10 m-0 flex w-full max-w-sm flex-col overflow-hidden rounded-lg border p-0 shadow-2xl ${panelClass}`}
            >
                <header className={`border-b px-5 py-4 ${lineClass}`}>
                    <h3 id={titleId} className="flex items-center gap-2 text-lg font-semibold">
                        <span className="codicon codicon-lock" aria-hidden="true" />
                        {title}
                    </h3>
                    <p id={descriptionId} className={`mt-1 text-sm ${mutedTextClass(isDark)}`}>{description}</p>
                </header>
                <div className="space-y-4 px-5 py-4 text-sm">{children}</div>
                <footer className={`flex justify-end gap-2 border-t px-5 py-3 ${lineClass}`}>
                    <button type="button" onClick={onClose} className={`rounded-lg border px-4 py-2 text-sm ${secondaryButtonClass}`}>
                        {cancelLabel}
                    </button>
                    <button
                        type="submit"
                        disabled={busy || !canSubmit}
                        className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitLabel}
                    </button>
                </footer>
            </form>
        </div>
    );
}
