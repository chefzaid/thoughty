import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { aiActionButtonClass } from '../EntryForm/aiActionButton';
import { useAnchoredPanel } from '../EntryForm/useAnchoredPanel';
import type { TranslationFunction } from '../../types';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { tintedTextClass, mutedTextClass } from '../../utils/tintedText';
import type { Language } from '../../utils/translations';
import { PROMPT_CARD_THEMES, type PromptCardTheme } from './promptCardDeck';
import { drawPromptCard, parseDrawnPromptCards, promptCardDeck, type PromptCardDraw } from './promptCards';

interface PromptCardsMenuProps {
    readonly language: Language;
    /** The `promptCardsDrawn` setting: the cards drawn since their deck was last used up. */
    readonly drawn?: string;
    /** Saves the cards drawn, so none repeats on another device or after a reload. */
    readonly onDrawnChange: (drawn: string) => void;
    /** Puts the question in the entry, the way the AI's questions are. */
    readonly onSelect: (question: string) => void;
    readonly theme?: 'light' | 'dark';
    readonly t: TranslationFunction;
}

const ALL_THEMES = 'all';

/**
 * **Draw a card** in the composer: a hand-written question from a deck by theme, or from all of them,
 * that needs no AI. No card comes back until every card of its deck has been drawn.
 */
export default function PromptCardsMenu({ language, drawn, onDrawnChange, onSelect, theme, t }: PromptCardsMenuProps) {
    const [open, setOpen] = useState(false);
    const [deckTheme, setDeckTheme] = useState<PromptCardTheme | null>(null);
    const [draw, setDraw] = useState<PromptCardDraw | null>(null);
    const writeButtonRef = useRef<HTMLButtonElement>(null);
    const deck = useMemo(() => promptCardDeck(language), [language]);
    const isLight = theme === 'light';

    const close = useCallback(() => setOpen(false), []);
    const { anchorRef, panelRef, buttonRef, position } = useAnchoredPanel(open, close);

    const drawCard = (fromTheme: PromptCardTheme | null) => {
        const next = drawPromptCard(deck, parseDrawnPromptCards(drawn, deck), fromTheme);
        setDraw(next);
        onDrawnChange(next.drawn.join(','));
    };

    const handleToggle = () => {
        if (open) {
            setOpen(false);
            return;
        }
        drawCard(deckTheme);
        setOpen(true);
    };

    const changeTheme = (value: string) => {
        const nextTheme = PROMPT_CARD_THEMES.find((candidate) => candidate === value) ?? null;
        setDeckTheme(nextTheme);
        drawCard(nextTheme);
    };

    const writeAboutIt = (question: string) => {
        onSelect(question);
        setOpen(false);
        buttonRef.current?.focus();
    };

    // The panel opens on its card, so Enter writes about it at once and Tab reaches the theme and Draw another
    useEffect(() => {
        if (open) {
            writeButtonRef.current?.focus();
        }
    }, [open]);

    const panelClass = isLight ? 'border-gray-200 bg-white text-gray-800' : 'border-gray-700 bg-gray-800 text-gray-100';
    const fieldClass = isLight ? 'border-gray-300 bg-gray-50 text-gray-900' : 'border-gray-700 bg-gray-900 text-gray-100';
    const themeName = (cardTheme: PromptCardTheme) => t(`promptCardsTheme_${cardTheme}`);

    return (
        <>
            <div className="relative" ref={anchorRef}>
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={handleToggle}
                    className={aiActionButtonClass('violet', theme)}
                    title={t('promptCardsDescription')}
                    aria-expanded={open}
                    aria-haspopup="dialog"
                >
                    <span className="codicon codicon-layers" aria-hidden="true" />
                    {t('promptCardsDraw')}
                </button>
            </div>
            {open && draw && createPortal(
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-label={t('promptCardsTitle')}
                    className={`fixed z-50 max-h-[min(26rem,calc(100vh-2rem))] overflow-y-auto rounded-lg border p-4 shadow-xl ${panelClass}`}
                    style={position}
                >
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">{t('promptCardsTitle')}</span>
                        <select
                            value={deckTheme ?? ALL_THEMES}
                            onChange={(event) => changeTheme(event.target.value)}
                            aria-label={t('promptCardsTheme')}
                            className={`h-8 min-w-0 rounded border px-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${fieldClass}`}
                        >
                            <option value={ALL_THEMES}>{t('promptCardsAllThemes')}</option>
                            {PROMPT_CARD_THEMES.map((cardTheme) => (
                                <option key={cardTheme} value={cardTheme}>{themeName(cardTheme)}</option>
                            ))}
                        </select>
                    </div>
                    <div aria-live="polite" className="space-y-2">
                        <figure
                            aria-label={t('promptCardsCard', { theme: themeName(draw.card.theme) })}
                            className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-3"
                        >
                            <figcaption className={`mb-1 text-xs font-semibold uppercase tracking-wide ${tintedTextClass('violet', theme)}`}>
                                {themeName(draw.card.theme)}
                            </figcaption>
                            <blockquote className="text-base leading-6">{draw.card.question}</blockquote>
                        </figure>
                        <p className={`text-xs ${mutedTextClass(!isLight)}`}>
                            {draw.reshuffled
                                ? t('promptCardsReshuffled')
                                : pluralPhrase(t, 'promptCardsLeft', draw.left, language)}
                        </p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <button
                            ref={writeButtonRef}
                            type="button"
                            onClick={() => writeAboutIt(draw.card.question)}
                            className={`flex-1 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-sm font-medium ${tintedTextClass('violet', theme)} transition-colors hover:bg-violet-500/20`}
                        >
                            {t('writeAboutThis')}
                        </button>
                        <button
                            type="button"
                            onClick={() => drawCard(deckTheme)}
                            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-gray-500/10 ${isLight ? 'border-gray-300' : 'border-gray-600'}`}
                        >
                            <span className="codicon codicon-refresh" aria-hidden="true" />
                            {t('promptCardsDrawAnother')}
                        </button>
                    </div>
                </div>,
                document.body,
            )}
        </>
    );
}
