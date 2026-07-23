import { useCallback, useEffect, useRef, useState } from 'react';
import type { SummaryGuidance } from '../../services/api/aiService';
import type { TranslationFunction as TranslationFn } from '../../types';

interface EntrySummaryDialogProps {
    entryId: number;
    isOpen: boolean;
    isDark: boolean;
    onClose: () => void;
    onSummarize: (entryId: number, guidance: SummaryGuidance) => Promise<string | null>;
    t: TranslationFn;
}

export default function EntrySummaryDialog({
    entryId,
    isOpen,
    isDark,
    onClose,
    onSummarize,
    t,
}: Readonly<EntrySummaryDialogProps>) {
    const [includeDetails, setIncludeDetails] = useState('');
    const [excludeDetails, setExcludeDetails] = useState('');
    const [summary, setSummary] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const includeInputRef = useRef<HTMLTextAreaElement>(null);
    const requestIdRef = useRef(0);

    useEffect(() => {
        if (!isOpen) {
            requestIdRef.current += 1;
            return;
        }

        setIncludeDetails('');
        setExcludeDetails('');
        setSummary('');
        setLoading(false);
        setError('');
        setCopied(false);
        includeInputRef.current?.focus();
    }, [entryId, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        globalThis.addEventListener('keydown', handleKeyDown);
        return () => globalThis.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleGenerate = useCallback(async () => {
        if (loading) {
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setLoading(true);
        setError('');
        setCopied(false);

        let result: string | null = null;
        try {
            result = await onSummarize(entryId, {
                includeDetails: includeDetails.trim() || undefined,
                excludeDetails: excludeDetails.trim() || undefined,
            });
        } catch {
            result = null;
        }

        if (requestId !== requestIdRef.current) {
            return;
        }

        setLoading(false);
        if (result === null) {
            setError(t('summaryError'));
            return;
        }
        setSummary(result);
    }, [entryId, excludeDetails, includeDetails, loading, onSummarize, t]);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(summary);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    }, [summary]);

    if (!isOpen) {
        return null;
    }

    const panelClass = isDark
        ? 'border-gray-700 bg-gray-800 text-gray-100'
        : 'border-gray-200 bg-white text-gray-900';
    const inputClass = isDark
        ? 'border-gray-600 bg-gray-900 text-gray-100 placeholder:text-gray-500'
        : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-400';
    const secondaryButtonClass = isDark
        ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
        : 'border-gray-300 text-gray-700 hover:bg-gray-100';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
                type="button"
                className="absolute inset-0 cursor-default bg-black/60"
                onClick={onClose}
                aria-label={t('close')}
            />
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby={`entry-summary-title-${entryId}`}
                className={`relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border shadow-2xl ${panelClass}`}
            >
                <header className={`flex items-center justify-between border-b px-5 py-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <h3 id={`entry-summary-title-${entryId}`} className="text-base font-semibold">
                        {t('entrySummary')}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-500/10 hover:text-gray-300"
                        title={t('close')}
                        aria-label={t('close')}
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>
                </header>
                <div className="space-y-4 overflow-y-auto px-5 py-4">
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">{t('summaryIncludeDetails')}</span>
                        <textarea
                            ref={includeInputRef}
                            value={includeDetails}
                            onChange={(event) => setIncludeDetails(event.target.value)}
                            maxLength={500}
                            rows={2}
                            className={`w-full resize-y rounded border px-3 py-2 text-sm outline-none focus:border-sky-500 ${inputClass}`}
                            placeholder={t('summaryIncludeDetailsPlaceholder')}
                        />
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium">{t('summaryExcludeDetails')}</span>
                        <textarea
                            value={excludeDetails}
                            onChange={(event) => setExcludeDetails(event.target.value)}
                            maxLength={500}
                            rows={2}
                            className={`w-full resize-y rounded border px-3 py-2 text-sm outline-none focus:border-sky-500 ${inputClass}`}
                            placeholder={t('summaryExcludeDetailsPlaceholder')}
                        />
                    </label>
                    {error && (
                        <p role="alert" className="text-sm text-red-400">{error}</p>
                    )}
                    {summary && (
                        <div className={`space-y-3 border-t pt-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                            <p className="whitespace-pre-wrap text-sm leading-6" aria-live="polite">{summary}</p>
                            <button
                                type="button"
                                onClick={() => void handleCopy()}
                                className={`inline-flex items-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${secondaryButtonClass}`}
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <path d="M8 8h11v11H8z" />
                                    <path d="M5 16H4V4h12v1" />
                                </svg>
                                {copied ? t('summaryCopied') : t('copySummary')}
                            </button>
                        </div>
                    )}
                </div>
                <footer className={`flex justify-end gap-3 border-t px-5 py-4 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`rounded border px-4 py-2 text-sm transition-colors ${secondaryButtonClass}`}
                    >
                        {t('close')}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleGenerate()}
                        disabled={loading}
                        className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading
                            ? t('generatingSummary')
                            : t(summary ? 'regenerateSummary' : 'generateSummary')}
                    </button>
                </footer>
            </section>
        </div>
    );
}
