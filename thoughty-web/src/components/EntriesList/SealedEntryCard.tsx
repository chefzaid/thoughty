import { useState } from 'react';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import type { Entry, TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import { formatTimeCapsuleMoment } from '../../utils/timeCapsule';
import { tintedTextClass } from '../../utils/tintedText';

interface SealedEntryCardProps {
    readonly entry: Entry & { sealed_until: string };
    readonly theme?: 'light' | 'dark';
    readonly language: Language;
    readonly showDiaryLabel: boolean;
    /** Opens the capsule now; the card asks for confirmation first. */
    readonly onUnseal?: (entry: Entry) => void;
    readonly onDelete: (id: number) => void;
    readonly t: TranslationFunction;
}

/**
 * A sealed time capsule in the journal: a placeholder that says when it opens, with nothing of its words,
 * title, tags or files, and a way to open it early after a confirmation, or to delete it.
 */
export default function SealedEntryCard({ entry, theme, language, showDiaryLabel, onUnseal, onDelete, t }: SealedEntryCardProps) {
    const [confirming, setConfirming] = useState(false);
    const isDark = theme !== 'light';
    const opensAt = formatTimeCapsuleMoment(entry.sealed_until, language);
    const buttonClass = 'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors';

    return (
        <section aria-label={t('timeCapsuleSealedLabel')} className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
                <span
                    className={`codicon codicon-lock mt-0.5 text-xl ${tintedTextClass('indigo', theme)}`}
                    aria-hidden="true"
                />
                <div className="min-w-0 space-y-1">
                    <p className={`font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                        {t('timeCapsuleCardTitle')}
                        {showDiaryLabel && entry.diary_name && (
                            <span className={`ml-2 text-xs font-normal ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {entry.diary_icon} {entry.diary_name}
                            </span>
                        )}
                    </p>
                    <p className={isDark ? 'text-gray-200' : 'text-gray-800'}>{t('timeCapsuleSealedUntil', { date: opensAt })}</p>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('timeCapsuleSealedHint')}</p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                {onUnseal && (
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className={`${buttonClass} border-indigo-500/40 bg-indigo-500/10 ${tintedTextClass('indigo', theme)} hover:bg-indigo-500/20`}
                    >
                        <span className="codicon codicon-unlock" aria-hidden="true" />
                        {t('timeCapsuleOpenEarly')}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => onDelete(entry.id)}
                    className={`${buttonClass} border-red-500/40 bg-red-500/10 ${tintedTextClass('red', theme)} hover:bg-red-500/20`}
                >
                    <span className="codicon codicon-trash" aria-hidden="true" />
                    {t('delete')}
                </button>
            </div>
            <ConfirmModal
                isOpen={confirming}
                onClose={() => setConfirming(false)}
                onConfirm={() => {
                    setConfirming(false);
                    onUnseal?.(entry);
                }}
                title={t('timeCapsuleOpenEarlyTitle')}
                message={t('timeCapsuleOpenEarlyMessage', { date: opensAt })}
                confirmLabel={t('timeCapsuleOpenEarlyConfirm')}
                theme={theme}
                t={t}
            />
        </section>
    );
}
