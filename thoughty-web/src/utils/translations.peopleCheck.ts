import type { Language } from './translations';

/** The check of the people an entry names, before it is shared. */
export type PeopleCheckTranslationKey =
  | 'peopleCheckTitle'
  | 'peopleCheckIntro'
  | 'peopleCheckMentions_one'
  | 'peopleCheckMentions_other'
  | 'peopleCheckReplaceWith'
  | 'peopleCheckInitials'
  | 'peopleCheckWordFeminine'
  | 'peopleCheckWordMasculine'
  | 'peopleCheckKeep'
  | 'peopleCheckReplace'
  | 'peopleCheckShareAnyway'
  | 'peopleCheckNoteEditor'
  | 'peopleCheckNoteSaved'
  | 'peopleCheckNoteCard'
  | 'peopleCheckReplaced_one'
  | 'peopleCheckReplaced_other'
  | 'peopleCheckReplaceFailed';

export const peopleCheckTranslations: Record<Language, Record<PeopleCheckTranslationKey, string>> = {
  en: {
    peopleCheckTitle: 'People in what you share',
    peopleCheckIntro: 'Shared, a mention is only the words you wrote: whoever reads it sees these names.',
    peopleCheckMentions_one: '{count} mention',
    peopleCheckMentions_other: '{count} mentions',
    peopleCheckReplaceWith: 'Replace {name} with',
    peopleCheckInitials: 'Initials ({initials})',
    peopleCheckWordFeminine: 'a friend',
    peopleCheckWordMasculine: 'a friend',
    peopleCheckKeep: 'Keep as written',
    peopleCheckReplace: 'Replace',
    peopleCheckShareAnyway: 'Share anyway',
    peopleCheckNoteEditor: 'Replace changes the text in the editor, without sharing it, so you can read it again first.',
    peopleCheckNoteSaved: 'Replace saves the entry with the new words, without sharing it, so you can read it again first. Its earlier text stays in its history, and a mention replaced no longer links it to the person.',
    peopleCheckNoteCard: 'Replace changes only the card\'s text, not the entry.',
    peopleCheckReplaced_one: 'Names replaced in {count} entry. Read it again before sharing it.',
    peopleCheckReplaced_other: 'Names replaced in {count} entries. Read them again before sharing them.',
    peopleCheckReplaceFailed: 'The names could not be replaced in every entry. Please try again.',
  },
  fr: {
    peopleCheckTitle: 'Les personnes dans ce que vous partagez',
    peopleCheckIntro: 'Une fois partagée, une mention n\'est que le texte que vous avez écrit : quiconque le lit voit ces noms.',
    peopleCheckMentions_one: '{count} mention',
    peopleCheckMentions_other: '{count} mentions',
    peopleCheckReplaceWith: 'Remplacer {name} par',
    peopleCheckInitials: 'Initiales ({initials})',
    peopleCheckWordFeminine: 'une amie',
    peopleCheckWordMasculine: 'un ami',
    peopleCheckKeep: 'Garder tel quel',
    peopleCheckReplace: 'Remplacer',
    peopleCheckShareAnyway: 'Partager quand même',
    peopleCheckNoteEditor: 'Remplacer modifie le texte dans l\'éditeur, sans le partager, pour que vous puissiez le relire d\'abord.',
    peopleCheckNoteSaved: 'Remplacer enregistre l\'entrée avec les nouveaux mots, sans la partager, pour que vous puissiez la relire d\'abord. Son texte précédent reste dans son historique, et une mention remplacée ne la relie plus à la personne.',
    peopleCheckNoteCard: 'Remplacer ne modifie que le texte de la carte, pas l\'entrée.',
    peopleCheckReplaced_one: 'Noms remplacés dans {count} entrée. Relisez-la avant de la partager.',
    peopleCheckReplaced_other: 'Noms remplacés dans {count} entrées. Relisez-les avant de les partager.',
    peopleCheckReplaceFailed: 'Les noms n\'ont pas pu être remplacés dans toutes les entrées. Veuillez réessayer.',
  },
};
