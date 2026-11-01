import type { Language } from './translations';

export type PromptCardsTranslationKey =
  | 'promptCardsDraw'
  | 'promptCardsDescription'
  | 'promptCardsTitle'
  | 'promptCardsTheme'
  | 'promptCardsAllThemes'
  | 'promptCardsTheme_gratitude'
  | 'promptCardsTheme_decisions'
  | 'promptCardsTheme_people'
  | 'promptCardsTheme_places'
  | 'promptCardsTheme_smallJoys'
  | 'promptCardsCard'
  | 'promptCardsDrawAnother'
  | 'promptCardsLeft_one'
  | 'promptCardsLeft_other'
  | 'promptCardsReshuffled';

export const promptCardsTranslations: Record<Language, Record<PromptCardsTranslationKey, string>> = {
  en: {
    promptCardsDraw: 'Draw a card',
    promptCardsDescription: 'A hand-written question from the prompt card deck, no AI needed',
    promptCardsTitle: 'Prompt cards',
    promptCardsTheme: 'Theme',
    promptCardsAllThemes: 'All themes',
    promptCardsTheme_gratitude: 'Gratitude',
    promptCardsTheme_decisions: 'Decisions',
    promptCardsTheme_people: 'People',
    promptCardsTheme_places: 'Places',
    promptCardsTheme_smallJoys: 'Small joys',
    promptCardsCard: '{theme} card',
    promptCardsDrawAnother: 'Draw another card',
    promptCardsLeft_one: '{count} card left before the deck is shuffled',
    promptCardsLeft_other: '{count} cards left before the deck is shuffled',
    promptCardsReshuffled: 'You had drawn every card here, so the deck was shuffled again.',
  },
  fr: {
    promptCardsDraw: 'Tirer une carte',
    promptCardsDescription: 'Une question écrite à la main, tirée du paquet de cartes, sans IA',
    promptCardsTitle: 'Cartes questions',
    promptCardsTheme: 'Thème',
    promptCardsAllThemes: 'Tous les thèmes',
    promptCardsTheme_gratitude: 'Gratitude',
    promptCardsTheme_decisions: 'Décisions',
    promptCardsTheme_people: 'Les gens',
    promptCardsTheme_places: 'Lieux',
    promptCardsTheme_smallJoys: 'Petits bonheurs',
    promptCardsCard: 'Carte « {theme} »',
    promptCardsDrawAnother: 'Tirer une autre carte',
    promptCardsLeft_one: 'Encore {count} carte avant de remélanger le paquet',
    promptCardsLeft_other: 'Encore {count} cartes avant de remélanger le paquet',
    promptCardsReshuffled: 'Vous aviez tiré toutes les cartes de ce paquet : il vient d’être remélangé.',
  },
};
