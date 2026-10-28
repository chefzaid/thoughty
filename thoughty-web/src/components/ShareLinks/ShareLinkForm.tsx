import { useId, useState, type FormEvent, type RefObject } from 'react';
import type { ShareLinkDraft } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { customExpiryBounds, SHARE_LINK_EXPIRY_CHOICES, shareLinkExpiresAt, type ShareLinkExpiryChoice } from './shareLinkExpiry';

const MAX_VIEWS = 1000;
const LABEL_MAX_LENGTH = 80;

interface ShareLinkFormProps {
    /** Entries can show their mood and tags; a book is shared as its file. */
    readonly forEntry: boolean;
    readonly creating: boolean;
    readonly fieldClass: string;
    readonly firstFieldRef: RefObject<HTMLSelectElement | null>;
    readonly onCreate: (draft: Omit<ShareLinkDraft, 'kind' | 'targetId'>) => Promise<boolean>;
    readonly t: TranslationFunction;
}

/** The choices of a new link: when it expires, an optional view limit and note, and for an entry its mood and tags. */
export default function ShareLinkForm({ forEntry, creating, fieldClass, firstFieldRef, onCreate, t }: ShareLinkFormProps) {
    const bounds = customExpiryBounds();
    const [expiry, setExpiry] = useState<ShareLinkExpiryChoice>('week');
    const [customDate, setCustomDate] = useState(bounds.min);
    const [maxViews, setMaxViews] = useState('');
    const [label, setLabel] = useState('');
    const [showMood, setShowMood] = useState(false);
    const [showTags, setShowTags] = useState(false);
    const ids = { expiry: useId(), date: useId(), dateHint: useId(), views: useId(), viewsHint: useId(), label: useId() };

    const expiresAt = shareLinkExpiresAt(expiry, customDate);
    const views = maxViews.trim() === '' ? null : Number(maxViews);
    const viewsValid = views === null || (Number.isInteger(views) && views >= 1 && views <= MAX_VIEWS);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!expiresAt || !viewsValid || creating) return;
        const made = await onCreate({
            expiresAt,
            label: label.trim() || null,
            maxViews: views,
            ...(forEntry ? { showMood, showTags } : {}),
        });
        if (made) {
            setLabel('');
            setMaxViews('');
        }
    };

    return (
        <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1" htmlFor={ids.expiry}>
                    <span className="text-sm font-medium">{t('shareLinkExpiry')}</span>
                    <select
                        id={ids.expiry}
                        ref={firstFieldRef}
                        value={expiry}
                        onChange={(event) => setExpiry(event.target.value as ShareLinkExpiryChoice)}
                        className={fieldClass}
                    >
                        {SHARE_LINK_EXPIRY_CHOICES.map((choice) => (
                            <option key={choice.value} value={choice.value}>{t(choice.labelKey)}</option>
                        ))}
                    </select>
                </label>
                {expiry === 'custom' && (
                    <label className="block space-y-1" htmlFor={ids.date}>
                        <span className="text-sm font-medium">{t('shareLinkExpiryDate')}</span>
                        <input
                            id={ids.date}
                            type="date"
                            min={bounds.min}
                            max={bounds.max}
                            value={customDate}
                            required
                            aria-describedby={ids.dateHint}
                            aria-invalid={expiresAt === null}
                            onChange={(event) => setCustomDate(event.target.value)}
                            className={fieldClass}
                        />
                    </label>
                )}
            </div>
            {expiry === 'custom' && <p id={ids.dateHint} className="text-xs opacity-80">{t('shareLinkExpiryDateHint')}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1" htmlFor={ids.views}>
                    <span className="text-sm font-medium">{t('shareLinkMaxViews')}</span>
                    <input
                        id={ids.views}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_VIEWS}
                        step={1}
                        value={maxViews}
                        aria-describedby={ids.viewsHint}
                        aria-invalid={!viewsValid}
                        onChange={(event) => setMaxViews(event.target.value)}
                        className={fieldClass}
                    />
                </label>
                <label className="block space-y-1" htmlFor={ids.label}>
                    <span className="text-sm font-medium">{t('shareLinkLabel')}</span>
                    <input
                        id={ids.label}
                        type="text"
                        maxLength={LABEL_MAX_LENGTH}
                        value={label}
                        placeholder={t('shareLinkLabelPlaceholder')}
                        onChange={(event) => setLabel(event.target.value)}
                        className={fieldClass}
                    />
                </label>
            </div>
            <p id={ids.viewsHint} className="text-xs opacity-80">{t('shareLinkMaxViewsHint')}</p>
            {forEntry && (
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={showMood} onChange={(event) => setShowMood(event.target.checked)} />
                        {t('shareLinkShowMood')}
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={showTags} onChange={(event) => setShowTags(event.target.checked)} />
                        {t('shareLinkShowTags')}
                    </label>
                </div>
            )}
            <button
                type="submit"
                disabled={creating || !expiresAt || !viewsValid}
                className="rounded bg-sky-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {creating ? t('shareLinkCreating') : t('shareLinkCreate')}
            </button>
        </form>
    );
}
