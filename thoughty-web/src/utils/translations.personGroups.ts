import type { Language } from './translations';

/** The writer's own groups of people (Friends, Family, Colleagues…), set and filtered on the People page. */
export type PersonGroupsTranslationKey =
  | 'personGroupsLabel'
  | 'personGroupsHelp'
  | 'personGroupsNone'
  | 'personGroupsAdd'
  | 'personGroupsAddButton'
  | 'personGroupsRemove'
  | 'personGroupsFull'
  | 'personGroupsTooMany'
  | 'peopleGroupFilter'
  | 'peopleGroupAll'
  | 'peopleGroupOption';

export const personGroupsTranslations: Record<Language, Record<PersonGroupsTranslationKey, string>> = {
  en: {
    personGroupsLabel: 'Groups',
    personGroupsHelp: 'Put {name} in groups of your own, like Friends, Family or Colleagues, to find them together on this page.',
    personGroupsNone: 'Not in a group yet.',
    personGroupsAdd: 'Add to a group',
    personGroupsAddButton: 'Add',
    personGroupsRemove: 'Remove {name} from {group}',
    personGroupsFull: '{name} is in {max} groups, the most a person can be in.',
    personGroupsTooMany: 'A person can be in at most {max} groups. Remove some to save.',
    peopleGroupFilter: 'Group',
    peopleGroupAll: 'Everyone',
    peopleGroupOption: '{name} ({count})',
  },
  fr: {
    personGroupsLabel: 'Groupes',
    personGroupsHelp: 'Placez {name} dans vos propres groupes, comme Amis, Famille ou Collègues, pour les retrouver ensemble sur cette page.',
    personGroupsNone: 'Dans aucun groupe pour l’instant.',
    personGroupsAdd: 'Ajouter à un groupe',
    personGroupsAddButton: 'Ajouter',
    personGroupsRemove: 'Retirer {name} de {group}',
    personGroupsFull: '{name} est dans {max} groupes, le maximum pour une personne.',
    personGroupsTooMany: 'Une personne peut être dans {max} groupes au plus. Retirez-en pour enregistrer.',
    peopleGroupFilter: 'Groupe',
    peopleGroupAll: 'Tout le monde',
    peopleGroupOption: '{name} ({count})',
  },
};
