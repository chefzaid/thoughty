import type { Language } from './translations';

/** The feed's private Saved list, and **Write about this** on another writer's entry. */
export type SavedEntriesTranslationKey =
  | 'feedSaved'
  | 'feedEmptySaved'
  | 'saveEntry'
  | 'savedEntry'
  | 'saveEntryBy'
  | 'saveUpdateError'
  | 'writeAboutEntryBy'
  | 'writeAboutReplaceMessage';

export const savedEntriesTranslations: Record<Language, Record<SavedEntriesTranslationKey, string>> = {
  en: {
    feedSaved: 'Saved',
    feedEmptySaved: 'Nothing saved yet. Save an entry from the feed to find it here again. Only you see this list, and the author is not told.',
    saveEntry: 'Save',
    savedEntry: 'Saved',
    saveEntryBy: 'Save the entry by {username}',
    saveUpdateError: 'Your Saved list could not be updated. Please try again.',
    writeAboutEntryBy: 'Write about the entry by {username}',
    writeAboutReplaceMessage:
      "The new entry form already holds a draft. Writing about this entry replaces its text, title, tags, time and mood with a short quote of it and its author's name, in a private entry dated today.",
  },
  fr: {
    feedSaved: 'Enregistrées',
    feedEmptySaved: "Rien d'enregistré pour l'instant. Enregistrez une entrée du fil pour la retrouver ici. Vous seul voyez cette liste, et son auteur n'en est pas averti.",
    saveEntry: 'Enregistrer',
    savedEntry: 'Enregistrée',
    saveEntryBy: "Enregistrer l'entrée de {username}",
    saveUpdateError: "Votre liste d'entrées enregistrées n'a pas pu être mise à jour. Veuillez réessayer.",
    writeAboutEntryBy: "Écrire au sujet de l'entrée de {username}",
    writeAboutReplaceMessage:
      "Le formulaire de nouvelle entrée contient déjà un brouillon. Écrire au sujet de cette entrée remplace son texte, son titre, ses tags, son heure et son humeur par une courte citation de l'entrée et le nom de son auteur, dans une entrée privée à la date d'aujourd'hui.",
  },
};
