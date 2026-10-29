import { useEffect, useId, useRef, useState } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { shareLinkUrl, type ShareLinksService, type ShareLinkTarget } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { tintedTextClass } from '../../utils/tintedText';
import type { Language } from '../../utils/translations';
import ShareLinkForm from './ShareLinkForm';
import { formatShareDate, shareLinkName, shareLinkViews } from './shareLinkText';
import { useShareLinks } from './useShareLinks';

export interface ShareLinkDialogProps {
    readonly isOpen: boolean;
    readonly target: ShareLinkTarget;
    /** What is shared, as the writer knows it: the entry's title or date, or the book version. */
    readonly subject: string;
    readonly isDark: boolean;
    readonly language: Language;
    readonly service: ShareLinksService;
    readonly onClose: () => void;
    readonly t: TranslationFunction;
}

/**
 * Makes and manages the private share links of one entry or book version in a modal dialog: a new
 * link's address is shown once, to copy, and each unexpired link can be revoked.
 */
export default function ShareLinkDialog({ isOpen, target, subject, isDark, language, service, onClose, t }: ShareLinkDialogProps) {
    const state = useShareLinks(service, target, isOpen);
    const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
    const dialogRef = useRef<HTMLDivElement>(null);
    const firstFieldRef = useRef<HTMLSelectElement>(null);
    const copyRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const introId = useId();
    const listTitleId = useId();
    const urlId = useId();
    const createdUrl = state.created ? shareLinkUrl(state.created.token) : null;

    useDialogFocus({ isOpen, dialogRef, initialFocusRef: firstFieldRef, onClose });

    useEffect(() => {
        setCopied('idle');
        if (createdUrl) copyRef.current?.focus();
    }, [createdUrl]);

    if (!isOpen) {
        return null;
    }

    const handleCopy = async () => {
        if (!createdUrl) return;
        try {
            await navigator.clipboard.writeText(createdUrl);
            setCopied('copied');
        } catch {
            setCopied('failed');
        }
    };

    const panelClass = isDark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
    const dividerClass = isDark ? 'border-gray-700' : 'border-gray-200';
    const fieldClass = `w-full rounded border px-3 py-2 text-sm outline-none focus:border-sky-500 ${isDark
        ? 'border-gray-600 bg-gray-900 text-gray-100 placeholder:text-gray-400'
        : 'border-gray-300 bg-white text-gray-900 placeholder:text-gray-500'}`;
    const secondaryButtonClass = isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100';
    const mutedClass = isDark ? 'text-gray-300' : 'text-gray-600';
    const forEntry = target.kind === 'entry';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop: a pointer target only; keyboard users close with Escape or the Close button. */}
            <button type="button" className="absolute inset-0 cursor-default bg-black/60" onClick={onClose} aria-hidden="true" tabIndex={-1} />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={introId}
                className={`relative z-10 m-0 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border p-0 shadow-2xl ${panelClass}`}
            >
                <header className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${dividerClass}`}>
                    <div className="min-w-0">
                        <h3 id={titleId} className="text-lg font-semibold">{t('sharePrivatelyTitle')}</h3>
                        <p className={`truncate text-sm ${mutedClass}`}>{subject}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded p-1 text-gray-500 transition-colors hover:bg-gray-500/10 hover:text-gray-300"
                        title={t('close')}
                        aria-label={t('close')}
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>
                </header>
                <div className="space-y-5 overflow-y-auto px-5 py-4">
                    <p id={introId} className={`text-sm ${mutedClass}`}>{t(forEntry ? 'shareLinkEntryIntro' : 'shareLinkBookIntro')}</p>
                    {createdUrl && (
                        <div className={`space-y-2 rounded border p-3 ${isDark ? 'border-sky-700 bg-sky-950/40' : 'border-sky-200 bg-sky-50'}`}>
                            <p className="text-sm font-medium">{t('shareLinkCreated')}</p>
                            <label htmlFor={urlId} className="sr-only">{t('shareLinkUrlLabel')}</label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input id={urlId} type="text" readOnly value={createdUrl} onFocus={(event) => event.target.select()} className={`${fieldClass} font-mono`} />
                                <button
                                    ref={copyRef}
                                    type="button"
                                    onClick={() => void handleCopy()}
                                    className={`shrink-0 rounded border px-3 py-2 text-sm transition-colors ${secondaryButtonClass}`}
                                >
                                    {copied === 'copied' ? t('shareLinkCopied') : t('shareLinkCopy')}
                                </button>
                            </div>
                            {copied === 'failed' && <p role="alert" className={`text-sm ${tintedTextClass('red', isDark ? 'dark' : 'light')}`}>{t('shareLinkCopyFailed')}</p>}
                        </div>
                    )}
                    <ShareLinkForm
                        forEntry={forEntry}
                        creating={state.creating}
                        fieldClass={fieldClass}
                        firstFieldRef={firstFieldRef}
                        onCreate={state.create}
                        t={t}
                    />
                    {state.error && (
                        <p role="alert" className={`text-sm ${tintedTextClass('red', isDark ? 'dark' : 'light')}`}>{t(state.error)}</p>
                    )}
                    <section aria-labelledby={listTitleId} className={`space-y-2 border-t pt-4 ${dividerClass}`}>
                        <h4 id={listTitleId} className="text-sm font-semibold">{t('shareLinksActive')}</h4>
                        {!state.loading && state.links.length === 0 && <p className={`text-sm ${mutedClass}`}>{t('shareLinksNone')}</p>}
                        {state.links.length > 0 && (
                            <ul className="space-y-2">
                                {state.links.map((link) => {
                                    const name = shareLinkName(link, t, language);
                                    return (
                                        <li key={link.id} className={`flex items-center justify-between gap-3 rounded border px-3 py-2 ${dividerClass}`}>
                                            <div className="min-w-0 text-sm">
                                                <p className="truncate font-medium">{name}</p>
                                                <p className={`text-xs ${mutedClass}`}>
                                                    {t('shareLinkExpires', { date: formatShareDate(link.expiresAt, language, true) })} · {shareLinkViews(link, t, language)}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void state.revoke(link.id)}
                                                disabled={state.revokingId !== null}
                                                aria-label={t('shareLinkRevokeLabel', { name })}
                                                className={`shrink-0 rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${isDark
                                                    ? 'border-red-400/60 text-red-300 hover:bg-red-500/10'
                                                    : 'border-red-300 text-red-700 hover:bg-red-50'}`}
                                            >
                                                {t('shareLinkRevoke')}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {state.limit !== null && (
                            <p className={`text-xs ${mutedClass}`}>{t('shareLinksCount', { count: state.activeCount, limit: state.limit })}</p>
                        )}
                        <p role="status" aria-live="polite" className="sr-only">{state.revoked ? t('shareLinkRevoked') : ''}</p>
                    </section>
                </div>
                <footer className={`flex justify-end border-t px-5 py-4 ${dividerClass}`}>
                    <button type="button" onClick={onClose} className={`rounded border px-4 py-2 text-sm transition-colors ${secondaryButtonClass}`}>
                        {t('close')}
                    </button>
                </footer>
            </div>
        </div>
    );
}
