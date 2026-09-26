import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AiSparkleIcon from '../AiSparkleIcon/AiSparkleIcon';
import { aiActionButtonClass } from './aiActionButton';

interface InspirationPanelPosition {
    left: number;
    width: number;
    top?: number;
    bottom?: number;
}

interface GetInspiredMenuProps {
    onGenerate: () => Promise<string | null>;
    onSelect: (question: string) => void;
    theme?: 'light' | 'dark';
    t: (key: string) => string;
}

export default function GetInspiredMenu({
    onGenerate,
    onSelect,
    theme,
    t,
}: Readonly<GetInspiredMenuProps>) {
    const [open, setOpen] = useState(false);
    const [question, setQuestion] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const requestIdRef = useRef(0);
    const [menuPosition, setMenuPosition] = useState<InspirationPanelPosition>({
        left: 16,
        top: 16,
        width: 352,
    });
    const isLight = theme === 'light';

    const loadQuestion = useCallback(async () => {
        if (loading) {
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setLoading(true);
        setError(false);

        let result: string | null = null;
        try {
            result = await onGenerate();
        } catch {
            result = null;
        }

        if (requestId !== requestIdRef.current) {
            return;
        }

        setLoading(false);
        if (!result?.trim()) {
            setError(true);
            return;
        }
        setQuestion(result.trim());
    }, [loading, onGenerate]);

    const handleToggle = useCallback(() => {
        const nextOpen = !open;
        setOpen(nextOpen);
        if (nextOpen && !question) {
            void loadQuestion();
        }
    }, [loadQuestion, open, question]);

    const handleSelect = useCallback((selected: string) => {
        onSelect(selected);
        setOpen(false);
        setQuestion(null);
    }, [onSelect]);

    const updateMenuPosition = useCallback(() => {
        const button = buttonRef.current;
        if (!button) {
            return;
        }

        const bounds = button.getBoundingClientRect();
        const viewportPadding = 16;
        const width = Math.min(352, globalThis.innerWidth - (viewportPadding * 2));
        const left = Math.min(
            Math.max(viewportPadding, bounds.left),
            globalThis.innerWidth - width - viewportPadding,
        );
        const opensDownward = bounds.bottom + 288 <= globalThis.innerHeight - viewportPadding;

        setMenuPosition({
            left,
            width,
            ...(opensDownward
                ? { top: bounds.bottom + 8 }
                : { bottom: globalThis.innerHeight - bounds.top + 8 }),
        });
    }, []);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        updateMenuPosition();
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!menuRef.current?.contains(target) && !panelRef.current?.contains(target)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handlePointerDown);
        globalThis.addEventListener('keydown', handleKeyDown);
        globalThis.addEventListener('resize', updateMenuPosition);
        globalThis.addEventListener('scroll', updateMenuPosition, true);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            globalThis.removeEventListener('keydown', handleKeyDown);
            globalThis.removeEventListener('resize', updateMenuPosition);
            globalThis.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [open, updateMenuPosition]);

    useEffect(() => {
        requestIdRef.current += 1;
        setOpen(false);
        setQuestion(null);
        setLoading(false);
        setError(false);
    }, [onGenerate]);

    useEffect(() => () => {
        requestIdRef.current += 1;
    }, []);

    const panelClass = isLight
        ? 'border-gray-200 bg-white text-gray-800'
        : 'border-gray-700 bg-gray-800 text-gray-100';

    return (
        <>
            <div className="relative" ref={menuRef}>
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={handleToggle}
                    disabled={loading && !open}
                    className={aiActionButtonClass('sky')}
                    title={t('getInspiredDescription')}
                    aria-expanded={open}
                    aria-haspopup="dialog"
                >
                    <AiSparkleIcon />
                    {t('getInspired')}
                </button>
            </div>
            {open && createPortal(
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label={t('getInspired')}
                    className={`fixed z-50 max-h-[min(24rem,calc(100vh-2rem))] overflow-y-auto rounded-lg border p-4 shadow-xl ${panelClass}`}
                    style={menuPosition}
                >
                    <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{t('inspirationTitle')}</span>
                        {question && !loading && (
                            <button
                                type="button"
                                onClick={() => void loadQuestion()}
                                className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-500/10 hover:text-sky-500"
                                title={t('askAnotherQuestion')}
                                aria-label={t('askAnotherQuestion')}
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5M6.5 8.5A7 7 0 0118 7M17.5 15.5A7 7 0 016 17" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {loading && (
                        <p className="py-4 text-center text-sm text-gray-500" aria-live="polite">
                            {t('findingInspiration')}
                        </p>
                    )}
                    {error && !loading && (
                        <div className="space-y-3 py-2">
                            <p role="alert" className="text-sm text-red-400">{t('inspirationError')}</p>
                            <button
                                type="button"
                                onClick={() => void loadQuestion()}
                                className="rounded border border-sky-500/40 px-3 py-1.5 text-sm text-sky-500 transition-colors hover:bg-sky-500/10"
                            >
                                {t('retry')}
                            </button>
                        </div>
                    )}
                    {question && !loading && !error && (
                        <div className="space-y-4">
                            <blockquote className="border-l-2 border-sky-500 pl-3 text-base leading-6">
                                {question}
                            </blockquote>
                            <button
                                type="button"
                                onClick={() => handleSelect(question)}
                                className="w-full rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-500 transition-colors hover:bg-sky-500/20"
                            >
                                {t('writeAboutThis')}
                            </button>
                        </div>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
}
