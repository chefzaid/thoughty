import type { Language } from './translations';

/** The writer's own notes on a person, edited and shown on the People page. */
export type PersonNotesTranslationKey =
  | 'personNotesLabel'
  | 'personNotesHelp'
  | 'personNotesLength'
  | 'personNotesTooLong';

export const personNotesTranslations: Record<Language, Record<PersonNotesTranslationKey, string>> = {
  en: {
    personNotesLabel: 'Notes',
    personNotesHelp: 'Anything you want to remember about {name}: how you met, what they like, a gift idea. Only you see your notes.',
    personNotesLength: '{count} of {max} characters',
    personNotesTooLong: 'Notes can be at most {max} characters. Shorten them to save.',
  },
  fr: {
    personNotesLabel: 'Notes',
    personNotesHelp: 'Ce que vous voulez retenir sur {name} : votre rencontre, ses goûts, une idée de cadeau. Vous seul voyez vos notes.',
    personNotesLength: '{count} sur {max} caractères',
    personNotesTooLong: 'Les notes ne peuvent pas dépasser {max} caractères. Raccourcissez-les pour enregistrer.',
  },
};
