import type { Language } from './translations';

/** People: someone mentioned with `@handle` in entries, their journal view and the People page. */
export type PeopleTranslationKey =
  | 'peopleLoadFailed'
  | 'personSaveFailed'
  | 'personMergeFailed'
  | 'personDeleteFailed';

export const peopleTranslations: Record<Language, Record<PeopleTranslationKey, string>> = {
  en: {
    peopleLoadFailed: 'Your people could not be loaded.',
    personSaveFailed: 'The name could not be saved.',
    personMergeFailed: 'These people could not be merged.',
    personDeleteFailed: 'This person could not be deleted.',
  },
  fr: {
    peopleLoadFailed: 'Vos personnes n’ont pas pu être chargées.',
    personSaveFailed: 'Le nom n’a pas pu être enregistré.',
    personMergeFailed: 'Ces personnes n’ont pas pu être fusionnées.',
    personDeleteFailed: 'Cette personne n’a pas pu être supprimée.',
  },
};
