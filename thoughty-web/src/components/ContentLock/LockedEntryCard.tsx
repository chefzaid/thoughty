import type { Entry, TranslationFunction } from '../../types';
import { mutedTextClass, tintedTextClass } from '../../utils/tintedText';
import { useContentLock } from './contentLockContext';

interface LockedEntryCardProps {
    readonly entry: Entry;
    readonly theme?: 'light' | 'dark';
    readonly showDiaryLabel: boolean;
    readonly t: TranslationFunction;
}

const PLACEHOLDER_WIDTHS = ['w-11/12', 'w-4/5', 'w-2/3'];

/**
 * A locked entry the API withheld: its title stays readable, as under the privacy blur, and blurred bars stand
 * where its text would be. The bars are drawn, not words: the text never reached the page. Unblurring asks
 * for the PIN.
 */
export default function LockedEntryCard({ entry, theme, showDiaryLabel, t }: LockedEntryCardProps) {
    const contentLock = useContentLock();
    const isDark = theme !== 'light';
    const barClass = isDark ? 'bg-gray-600/70' : 'bg-gray-300';

    return (
        <section aria-label={t('lockedEntryLabel')} className="flex flex-col gap-3" data-locked-entry={entry.id}>
            <div className="flex items-start gap-3">
                <span className={`codicon codicon-lock mt-0.5 text-xl ${tintedTextClass('indigo', theme)}`} aria-hidden="true" />
                <div className="min-w-0 space-y-1">
                    {entry.title && <p className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{entry.title}</p>}
                    <p className={`text-sm ${mutedTextClass(isDark)}`}>
                        {t('lockedEntryHint')}
                        {showDiaryLabel && entry.diary_name && <span className="ml-2">{entry.diary_icon} {entry.diary_name}</span>}
                    </p>
                </div>
            </div>
            <div className="space-y-2 blur-[3px]" aria-hidden="true">
                {PLACEHOLDER_WIDTHS.map((width) => <div key={width} className={`h-3 rounded ${width} ${barClass}`} />)}
            </div>
            <span className="sr-only">{t('lockedEntryPlaceholder')}</span>
            {contentLock && (
                <div>
                    <button
                        type="button"
                        onClick={() => void contentLock.unblur()}
                        className={`inline-flex items-center gap-2 rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-sm ${tintedTextClass('indigo', theme)} hover:bg-indigo-500/20`}
                    >
                        <span className="codicon codicon-unlock" aria-hidden="true" />
                        {t('lockedEntryUnblur')}
                    </button>
                </div>
            )}
        </section>
    );
}
