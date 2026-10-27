import type { Language } from './translations';

/** People: someone mentioned with `@handle` in entries, their journal view and the People page. */
export type PeopleTranslationKey =
  | 'people'
  | 'peopleIntro'
  | 'peopleLoading'
  | 'peopleLoadFailed'
  | 'peopleEmpty'
  | 'peopleFind'
  | 'peopleCount'
  | 'peopleNoMatch'
  | 'peopleListLabel_one'
  | 'peopleListLabel_other'
  | 'personEntryCount_one'
  | 'personEntryCount_other'
  | 'personLastMentioned'
  | 'personMentionTitle'
  | 'personRename'
  | 'personNameLabel'
  | 'personNameHelp'
  | 'personNameRequired'
  | 'personSaving'
  | 'personRenamed'
  | 'personSaveFailed'
  | 'personMerge'
  | 'personMergeTitle'
  | 'personMergeDescription'
  | 'personMergeChoose'
  | 'personMergeConfirm'
  | 'personMerging'
  | 'personMerged'
  | 'personMergeFailed'
  | 'personDelete'
  | 'personDeleteTitle'
  | 'personDeleteMessage'
  | 'personDeleted'
  | 'personDeleteFailed'
  | 'personFilterLabel'
  | 'personFilterAll'
  | 'personFilterManage'
  | 'personViewTitle'
  | 'personViewAllPeople'
  | 'personViewClear'
  | 'savedSearchPerson'
  | 'mentionSuggestionsLabel'
  | 'mentionSuggestionsStatus_one'
  | 'mentionSuggestionsStatus_other';

export const peopleTranslations: Record<Language, Record<PeopleTranslationKey, string>> = {
  en: {
    people: 'People',
    peopleIntro: 'Mention someone with @ and their name in an entry (@Marie, @Jean-Paul) to find every entry about them here. People are your own notes: only you see them, and they are never linked to anyone’s account.',
    peopleLoading: 'Loading your people…',
    peopleLoadFailed: 'Your people could not be loaded.',
    peopleEmpty: 'No one yet. Write @ followed by a name in an entry, and that person appears here.',
    peopleFind: 'Find a person',
    peopleCount: 'People: {count} of {limit}',
    peopleNoMatch: 'No one matches this search.',
    peopleListLabel_one: '{count} person',
    peopleListLabel_other: '{count} people',
    personEntryCount_one: '{count} entry',
    personEntryCount_other: '{count} entries',
    personLastMentioned: 'last mentioned {date}',
    personMentionTitle: 'Entries that mention {name}',
    personRename: 'Rename {name}',
    personNameLabel: 'Name shown for {handle}',
    personNameHelp: 'Your entries keep the text you wrote; only the name shown here changes.',
    personNameRequired: 'Enter a name.',
    personSaving: 'Saving…',
    personRenamed: 'Renamed to {name}.',
    personSaveFailed: 'The name could not be saved.',
    personMerge: 'Merge someone into {name}',
    personMergeTitle: 'Merge into {name}',
    personMergeDescription: 'The person you choose is deleted: their handles then mention {name}, and their entries move to {name}. Your entries keep the text you wrote.',
    personMergeChoose: 'Person to merge',
    personMergeConfirm: 'Merge',
    personMerging: 'Merging…',
    personMerged: '{duplicate} was merged into {name}.',
    personMergeFailed: 'These people could not be merged.',
    personDelete: 'Delete {name}',
    personDeleteTitle: 'Delete {name}?',
    personDeleteMessage: 'Your entries keep the text {handle} but no longer link to this person. Saving an entry that still mentions {handle} adds them again.',
    personDeleted: '{name} was deleted.',
    personDeleteFailed: 'This person could not be deleted.',
    personFilterLabel: 'Person',
    personFilterAll: 'Anyone',
    personFilterManage: 'Manage people',
    personViewTitle: 'Entries that mention {name}',
    personViewAllPeople: 'All people',
    personViewClear: 'Show all entries',
    savedSearchPerson: 'with {name}',
    mentionSuggestionsLabel: 'People to mention',
    mentionSuggestionsStatus_one: '{count} person to mention. Up and down arrows to choose, Enter to insert, Escape to close.',
    mentionSuggestionsStatus_other: '{count} people to mention. Up and down arrows to choose, Enter to insert, Escape to close.',
  },
  fr: {
    people: 'Personnes',
    peopleIntro: 'Mentionnez quelqu’un avec @ et son nom dans une entrée (@Marie, @Jean-Paul) pour retrouver ici toutes les entrées qui en parlent. Ces personnes sont vos propres notes : vous seul les voyez, et elles ne sont jamais liées au compte de quiconque.',
    peopleLoading: 'Chargement de vos personnes…',
    peopleLoadFailed: 'Vos personnes n’ont pas pu être chargées.',
    peopleEmpty: 'Personne pour l’instant. Écrivez @ suivi d’un nom dans une entrée, et cette personne apparaîtra ici.',
    peopleFind: 'Trouver une personne',
    peopleCount: 'Personnes : {count} sur {limit}',
    peopleNoMatch: 'Personne ne correspond à cette recherche.',
    peopleListLabel_one: '{count} personne',
    peopleListLabel_other: '{count} personnes',
    personEntryCount_one: '{count} entrée',
    personEntryCount_other: '{count} entrées',
    personLastMentioned: 'dernière mention le {date}',
    personMentionTitle: 'Entrées qui mentionnent {name}',
    personRename: 'Renommer {name}',
    personNameLabel: 'Nom affiché pour {handle}',
    personNameHelp: 'Vos entrées gardent le texte que vous avez écrit ; seul le nom affiché ici change.',
    personNameRequired: 'Saisissez un nom.',
    personSaving: 'Enregistrement…',
    personRenamed: 'Renommé en {name}.',
    personSaveFailed: 'Le nom n’a pas pu être enregistré.',
    personMerge: 'Fusionner quelqu’un avec {name}',
    personMergeTitle: 'Fusionner avec {name}',
    personMergeDescription: 'La personne choisie est supprimée : ses identifiants mentionnent alors {name}, et ses entrées passent à {name}. Vos entrées gardent le texte que vous avez écrit.',
    personMergeChoose: 'Personne à fusionner',
    personMergeConfirm: 'Fusionner',
    personMerging: 'Fusion…',
    personMerged: '{duplicate} a été fusionné avec {name}.',
    personMergeFailed: 'Ces personnes n’ont pas pu être fusionnées.',
    personDelete: 'Supprimer {name}',
    personDeleteTitle: 'Supprimer {name} ?',
    personDeleteMessage: 'Vos entrées gardent le texte {handle} mais ne sont plus liées à cette personne. Enregistrer une entrée qui mentionne encore {handle} la rajoute.',
    personDeleted: '{name} a été supprimé.',
    personDeleteFailed: 'Cette personne n’a pas pu être supprimée.',
    personFilterLabel: 'Personne',
    personFilterAll: 'Tout le monde',
    personFilterManage: 'Gérer les personnes',
    personViewTitle: 'Entrées qui mentionnent {name}',
    personViewAllPeople: 'Toutes les personnes',
    personViewClear: 'Afficher toutes les entrées',
    savedSearchPerson: 'avec {name}',
    mentionSuggestionsLabel: 'Personnes à mentionner',
    mentionSuggestionsStatus_one: '{count} personne à mentionner. Flèches haut et bas pour choisir, Entrée pour insérer, Échap pour fermer.',
    mentionSuggestionsStatus_other: '{count} personnes à mentionner. Flèches haut et bas pour choisir, Entrée pour insérer, Échap pour fermer.',
  },
};
