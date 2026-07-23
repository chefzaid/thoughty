import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface PromptMenuPosition {
    left: number;
    width: number;
    top?: number;
    bottom?: number;
}

interface WritingPromptsMenuProps {
    onGenerate: () => Promise<string[] | null>;
    onSelect: (prompt: string) => void;
    theme?: 'light' | 'dark';
    t: (key: string) => string;
}

export default function WritingPromptsMenu({
    onGenerate,
    onSelect,
    theme,
    t,
}: Readonly<WritingPromptsMenuProps>) {
    const [open, setOpen] = useState(false);
    const [prompts, setPrompts] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const requestIdRef = useRef(0);
    const [menuPosition, setMenuPosition] = useState<PromptMenuPosition>({
        left: 16,
        top: 16,
        width: 352,
    });
    const isLight = theme === 'light';

    const loadPrompts = useCallback(async () => {
        if (loading) {
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setLoading(true);
        setError(false);

        let result: string[] | null = null;
        try {
            result = await onGenerate();
        } catch {
            result = null;
        }

        if (requestId !== requestIdRef.current) {
            return;
        }

        setLoading(false);
        if (!result || result.length === 0) {
            setError(true);
            return;
        }
        setPrompts(result);
    }, [loading, onGenerate]);

    const handleToggle = useCallback(() => {
        const nextOpen = !open;
        setOpen(nextOpen);
        if (nextOpen && prompts.length === 0) {
            void loadPrompts();
        }
    }, [loadPrompts, open, prompts.length]);

    const handleSelect = useCallback((prompt: string) => {
        onSelect(prompt);
        setOpen(false);
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
        setPrompts([]);
        setLoading(false);
        setError(false);
    }, [onGenerate]);

    useEffect(() => () => {
        requestIdRef.current += 1;
    }, []);

    const panelClass = isLight
        ? 'border-gray-200 bg-white text-gray-800'
        : 'border-gray-700 bg-gray-800 text-gray-100';
    const promptClass = isLight
        ? 'border-gray-200 hover:border-sky-400 hover:bg-sky-50'
        : 'border-gray-700 hover:border-sky-500 hover:bg-sky-500/10';

    return (
        <>
            <div className="relative" ref={menuRef}>
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={handleToggle}
                    disabled={loading && !open}
                    className="inline-flex h-10 items-center gap-2 rounded border border-sky-500/40 bg-sky-500/10 px-3 text-sm text-sky-500 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    title={t('writingPrompts')}
                    aria-expanded={open}
                    aria-haspopup="menu"
                >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM19 15l.75 2.25L22 18l-2.25.75L19 22l-.75-2.25L16 18l2.25-.75L19 15z" />
                    </svg>
                    {t('writingPrompts')}
                </button>
            </div>
            {open && createPortal(
                <div
                    ref={panelRef}
                    role="menu"
                    aria-label={t('writingPrompts')}
                    className={`fixed z-50 max-h-[min(24rem,calc(100vh-2rem))] overflow-y-auto rounded-lg border p-3 shadow-xl ${panelClass}`}
                    style={menuPosition}
                >
                    <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{t('chooseWritingPrompt')}</span>
                        {prompts.length > 0 && !loading && (
                            <button
                                type="button"
                                onClick={() => void loadPrompts()}
                                className="rounded p-1.5 text-gray-500 transition-colors hover:bg-gray-500/10 hover:text-sky-500"
                                title={t('regenerateWritingPrompts')}
                                aria-label={t('regenerateWritingPrompts')}
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7v5h-5M4 17v-5h5M6.5 8.5A7 7 0 0118 7M17.5 15.5A7 7 0 016 17" />
                                </svg>
                            </button>
                        )}
                    </div>
                    {loading && (
                        <p className="py-4 text-center text-sm text-gray-500" aria-live="polite">
                            {t('generatingWritingPrompts')}
                        </p>
                    )}
                    {error && !loading && (
                        <div className="space-y-3 py-2">
                            <p role="alert" className="text-sm text-red-400">{t('writingPromptsError')}</p>
                            <button
                                type="button"
                                onClick={() => void loadPrompts()}
                                className="rounded border border-sky-500/40 px-3 py-1.5 text-sm text-sky-500 transition-colors hover:bg-sky-500/10"
                            >
                                {t('retry')}
                            </button>
                        </div>
                    )}
                    {!loading && !error && (
                        <div className="space-y-2">
                            {prompts.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => handleSelect(prompt)}
                                    className={`w-full rounded border px-3 py-2 text-left text-sm leading-5 transition-colors ${promptClass}`}
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    )}
                </div>,
                document.body,
            )}
        </>
    );
}
