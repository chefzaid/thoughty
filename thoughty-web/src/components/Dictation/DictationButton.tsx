import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';
import type { TranslationFunction } from '../../types';
import { tintedTextClass } from '../../utils/tintedText';
import { readNoticeSeen, saveNoticeSeen } from './speechRecognition';
import type { DictationAnnouncement } from './useDictation';

interface DictationButtonProps {
    readonly listening: boolean;
    readonly announcement: DictationAnnouncement;
    /** Starts listening; called only after the writer has seen the note on where speech goes. */
    readonly onStart: () => void;
    readonly onStop: () => void;
    readonly theme?: 'light' | 'dark';
    /** Replaces the toolbar look (focus mode styles its own buttons). */
    readonly className?: string;
    readonly t: TranslationFunction;
}

function toolbarClass(listening: boolean, theme?: 'light' | 'dark'): string {
    const base = 'flex items-center px-3 py-2 rounded-lg border transition-all';
    if (listening) return `${base} border-red-500 bg-red-500/10 ${tintedTextClass('red', theme)}`;
    return theme === 'light'
        ? `${base} border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100`
        : `${base} border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700`;
}

/**
 * The microphone toggle of a writing field (`aria-pressed` while listening). The first time, it
 * shows a one-line note that the browser may send the audio to its maker's speech service, with
 * Start and Cancel; once started, the note is not shown again in this browser. Start and stop are
 * announced politely.
 */
export default function DictationButton({ listening, announcement, onStart, onStop, theme, className, t }: DictationButtonProps) {
    const [noticeOpen, setNoticeOpen] = useState(false);
    const noticeId = useId();
    const toggleRef = useRef<HTMLButtonElement>(null);
    const startRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (noticeOpen) startRef.current?.focus();
    }, [noticeOpen]);

    const toggle = () => {
        if (listening) {
            onStop();
        } else if (readNoticeSeen()) {
            onStart();
        } else {
            setNoticeOpen((open) => !open);
        }
    };

    const confirm = () => {
        saveNoticeSeen();
        setNoticeOpen(false);
        onStart();
    };

    const cancel = () => {
        setNoticeOpen(false);
        toggleRef.current?.focus();
    };

    const handleNoticeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Escape') return;
        // Only the note closes, not focus mode or a dialog behind it
        event.preventDefault();
        event.stopPropagation();
        cancel();
    };

    const handleNoticeBlur = (event: FocusEvent<HTMLDivElement>) => {
        const next = event.relatedTarget as Node | null;
        if (!event.currentTarget.contains(next) && next !== toggleRef.current) setNoticeOpen(false);
    };

    const panelClass = theme === 'light'
        ? 'bg-white border-gray-300 text-gray-800'
        : 'bg-gray-800 border-gray-600 text-gray-100';
    const secondaryClass = theme === 'light'
        ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
        : 'border-gray-600 text-gray-200 hover:bg-gray-700';

    return (
        <span className="relative inline-flex">
            <button
                ref={toggleRef}
                type="button"
                className={className ?? toolbarClass(listening, theme)}
                aria-pressed={listening}
                aria-label={t('dictation')}
                title={t('dictationHint')}
                data-dictation-toggle=""
                onClick={toggle}
            >
                <span className={`codicon codicon-${listening ? 'mic-filled' : 'mic'}`} aria-hidden="true" />
            </button>
            {noticeOpen && (
                <div
                    id={noticeId}
                    role="group"
                    aria-labelledby={`${noticeId}-text`}
                    className={`absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border p-3 text-sm shadow-lg ${panelClass}`}
                    onKeyDown={handleNoticeKeyDown}
                    onBlur={handleNoticeBlur}
                >
                    <p id={`${noticeId}-text`} className="mb-3">{t('dictationNotice')}</p>
                    <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" className={`rounded-md border px-3 py-1 ${secondaryClass}`} onClick={cancel}>
                            {t('dictationNoticeCancel')}
                        </button>
                        <button
                            ref={startRef}
                            type="button"
                            className="rounded-md bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-700"
                            onClick={confirm}
                        >
                            {t('dictationNoticeStart')}
                        </button>
                    </div>
                </div>
            )}
            <span role="status" className="sr-only">{announcement ? t(announcement) : ''}</span>
        </span>
    );
}
