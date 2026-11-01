import type { Language } from '../../utils/translations';
import { PROMPT_CARD_QUESTIONS, PROMPT_CARD_THEMES, type PromptCardTheme } from './promptCardDeck';

export interface PromptCard {
  /** `theme-number`, the card's place in the deck, counted from 1. */
  readonly id: string;
  readonly theme: PromptCardTheme;
  readonly question: string;
}

export interface PromptCardDraw {
  readonly card: PromptCard;
  /** The cards drawn since their deck was last used up, this one included. */
  readonly drawn: string[];
  /** True when every card of the deck had been drawn, so it was shuffled again for this one. */
  readonly reshuffled: boolean;
  /** The cards of the deck not drawn yet. */
  readonly left: number;
}

/** Every card in the writer's language, theme by theme. */
export function promptCardDeck(language: Language): PromptCard[] {
  return PROMPT_CARD_THEMES.flatMap((theme) => PROMPT_CARD_QUESTIONS[language][theme].map((question, index) => ({
    id: `${theme}-${index + 1}`,
    theme,
    question,
  })));
}

/** The drawn card ids from the `promptCardsDrawn` setting; unknown or repeated ids are left out. */
export function parseDrawnPromptCards(raw: string | undefined, deck: readonly PromptCard[]): string[] {
  const known = new Set(deck.map((card) => card.id));
  return [...new Set((raw ?? '').split(',').filter((id) => known.has(id)))];
}

/**
 * Draws a card of one theme, or of the whole deck when `theme` is null, among those not drawn yet.
 * Once every card of that deck has been drawn, its cards are shuffled back in, all but the last one
 * drawn, so a new round never opens on the question just shown.
 */
export function drawPromptCard(
  deck: readonly PromptCard[],
  drawn: readonly string[],
  theme: PromptCardTheme | null,
  random: () => number = Math.random,
): PromptCardDraw {
  const pile = theme ? deck.filter((card) => card.theme === theme) : [...deck];
  const seen = new Set(drawn);
  const unseen = pile.filter((card) => !seen.has(card.id));
  const reshuffled = unseen.length === 0;

  let keep = [...drawn];
  let candidates = unseen;
  if (reshuffled) {
    const pileIds = new Set(pile.map((card) => card.id));
    keep = drawn.filter((id) => !pileIds.has(id));
    const lastDrawn = [...drawn].reverse().find((id) => pileIds.has(id));
    candidates = pile.length > 1 ? pile.filter((card) => card.id !== lastDrawn) : pile;
  }

  const card = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
  if (!card) {
    throw new Error(`No prompt cards for ${theme ?? 'the deck'}`);
  }
  const next = [...keep, card.id];
  const nextSeen = new Set(next);
  return { card, drawn: next, reshuffled, left: pile.filter((item) => !nextSeen.has(item.id)).length };
}
