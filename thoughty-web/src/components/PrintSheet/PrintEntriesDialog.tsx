import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { Config, Entry, TranslationFunction as TranslationFn } from '../../types';
import { isMoodLevel } from '../../utils/entryMood';
import { resolveLanguage } from '../../utils/language';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { mutedTextClass } from '../../utils/tintedText';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import PrintSheet from './PrintSheet';
import { printableEntries, type PrintOptions } from './printableEntries';

interface PrintEntriesDialogProps {
    /** One entry, or the entries of a day. */
    readonly what: 'entry' | 'day';
    readonly entries: readonly Entry[];
    readonly config: Pick<Config, 'theme' | 'language' | 'fontFamily'>;
    readonly onClose: () => void;
    readonly t: TranslationFn;
}

const hasMood = (entry: Entry) => isMoodLevel(entry.mood) || (entry.feelings?.length ?? 0) > 0;

/**
 * Asks what to print with an entry or a day (its mood and feelings, its tags), then lays the print
 * view beside the app and opens the browser's print dialog once its pictures have loaded. When
 * printing is over, or cancelled, the print view goes and this dialog closes. Keyboard behavior is
 * that of every modal dialog: focus starts on Print (which stays focused while the pages are prepared),
 * Tab stays inside and Escape closes it.
 */
export default function PrintEntriesDialog({ what, entries, config, onClose, t }: PrintEntriesDialogProps) {
    const printed = printableEntries(entries);
    const offerMood = printed.some(hasMood);
    const offerTags = printed.some((entry) => entry.tags.length > 0);
    const [options, setOptions] = useState<PrintOptions>({ mood: true, tags: true });
    const [printing, setPrinting] = useState(false);
    const dialogRef = useRef<HTMLDivElement>(null);
    const printRef = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const language = resolveLanguage(config.language);
    const isDark = config.theme !== 'light';
    const first = printed[0];

    useDialogFocus({ isOpen: true, dialogRef, initialFocusRef: printRef, onClose });

    // The browser tells when its print dialog closes, printed or not
    useEffect(() => {
        if (!printing) return undefined;
        const finish = () => {
            setPrinting(false);
            onClose();
        };
        globalThis.addEventListener('afterprint', finish);
        return () => globalThis.removeEventListener('afterprint', finish);
    }, [onClose, printing]);

    const print = useCallback(() => globalThis.print(), []);

    if (!first) return null;

    const day = formatEntryDay(first.date, language);
    const subject = what === 'day'
        ? `${day} · ${pluralPhrase(t, 'printDayCount', printed.length, language)}`
        : [day, first.title?.trim()].filter(Boolean).join(' · ');
    const panelClass = isDark ? 'border-gray-700 bg-gray-800 text-gray-100' : 'border-gray-200 bg-white text-gray-900';
    const lineClass = isDark ? 'border-gray-700' : 'border-gray-200';
    const secondaryButtonClass = isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100';
    const toggle = (key: keyof PrintOptions) => setOptions((current) => ({ ...current, [key]: !current[key] }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop: a pointer target only; keyboard users close with Escape or Cancel. */}
            <button type="button" className="absolute inset-0 cursor-default bg-black/60" onClick={onClose} aria-hidden="true" tabIndex={-1} />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={`relative z-10 m-0 flex w-full max-w-md flex-col overflow-hidden rounded-lg border p-0 shadow-2xl ${panelClass}`}
            >
                <header className={`border-b px-5 py-4 ${lineClass}`}>
                    <h3 id={titleId} className="text-lg font-semibold">{t(what === 'day' ? 'printDayTitle' : 'printEntryTitle')}</h3>
                    <p className={`mt-1 text-sm ${mutedTextClass(isDark)}`}>{subject}</p>
                </header>
                <div className="space-y-4 px-5 py-4 text-sm">
                    {(offerMood || offerTags) && (
                        <fieldset className="space-y-2">
                            <legend className="mb-1 font-medium">{t('printInclude')}</legend>
                            {offerMood && (
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={options.mood} onChange={() => toggle('mood')} className="h-4 w-4 accent-sky-500" />
                                    {t('printIncludeMood')}
                                </label>
                            )}
                            {offerTags && (
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={options.tags} onChange={() => toggle('tags')} className="h-4 w-4 accent-sky-500" />
                                    {t('printIncludeTags')}
                                </label>
                            )}
                        </fieldset>
                    )}
                    <p className={mutedTextClass(isDark)}>{t('printHint')}</p>
                    <p role="status" className="min-h-[1.25rem]">{printing ? t('printPreparing') : ''}</p>
                </div>
                <footer className={`flex justify-end gap-3 border-t px-5 py-4 ${lineClass}`}>
                    <button type="button" onClick={onClose} className={`rounded border px-4 py-2 text-sm transition-colors ${secondaryButtonClass}`}>
                        {t('cancel')}
                    </button>
                    <button
                        ref={printRef}
                        type="button"
                        onClick={() => setPrinting(true)}
                        aria-disabled={printing}
                        className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-600 aria-disabled:cursor-wait aria-disabled:opacity-60"
                    >
                        {t('printConfirm')}
                    </button>
                </footer>
            </div>
            {printing && (
                <PrintSheet
                    entries={printed}
                    options={{ mood: offerMood && options.mood, tags: offerTags && options.tags }}
                    language={language}
                    fontFamily={config.fontFamily}
                    t={t}
                    onReady={print}
                />
            )}
        </div>
    );
}
