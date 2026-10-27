import type { Language } from './translations';

/** Life eras: named date ranges of the writer's life, managed in the profile and used across the app. */
export type LifeErasTranslationKey =
  | 'lifeEras'
  | 'lifeErasIntro'
  | 'lifeErasCount'
  | 'lifeErasEmpty'
  | 'lifeErasLoading'
  | 'lifeErasLoadFailed'
  | 'lifeErasLimitReached'
  | 'lifeEraAddTitle'
  | 'lifeEraEditTitle'
  | 'lifeEraName'
  | 'lifeEraNamePlaceholder'
  | 'lifeEraStart'
  | 'lifeEraEnd'
  | 'lifeEraEndHelp'
  | 'lifeEraEmoji'
  | 'lifeEraUseColor'
  | 'lifeEraColor'
  | 'lifeEraNote'
  | 'lifeEraAdd'
  | 'lifeEraSaveChanges'
  | 'lifeEraEdit'
  | 'lifeEraDelete'
  | 'lifeEraDeleteTitle'
  | 'lifeEraDeleteMessage'
  | 'lifeEraAdded'
  | 'lifeEraUpdated'
  | 'lifeEraDeleted'
  | 'lifeEraNameRequired'
  | 'lifeEraStartRequired'
  | 'lifeEraEndBeforeStart'
  | 'lifeEraSaveFailed'
  | 'lifeEraDeleteFailed'
  | 'lifeEraRange'
  | 'lifeEraSince'
  | 'eraFilterLabel'
  | 'eraFilterAll'
  | 'eraFilterManage'
  | 'calendarEraShowing'
  | 'calendarEraGoToStart'
  | 'bookChapterModeEras'
  | 'bookIncludeOutsideEras'
  | 'bookErasHint'
  | 'memoirEraToday'
  | 'memoirEraLabel'
  | 'memoirEraNone'
  | 'memoirEraHelp';

export const lifeErasTranslations: Record<Language, Record<LifeErasTranslationKey, string>> = {
  en: {
    lifeEras: 'Life eras',
    lifeErasIntro: 'Name the chapters of your life, such as “University” or “The Paris years”. Filter the journal by them, build a book with one chapter for each, and place memoir answers in them. Eras may overlap.',
    lifeErasCount: '{count} of {limit} eras',
    lifeErasEmpty: 'No life eras yet. Add the first one below.',
    lifeErasLoading: 'Loading life eras…',
    lifeErasLoadFailed: 'Life eras could not be loaded.',
    lifeErasLimitReached: 'You have reached the limit of {limit} life eras. Delete one to add another.',
    lifeEraAddTitle: 'Add a life era',
    lifeEraEditTitle: 'Edit “{name}”',
    lifeEraName: 'Name',
    lifeEraNamePlaceholder: 'University',
    lifeEraStart: 'Start date',
    lifeEraEnd: 'End date',
    lifeEraEndHelp: 'Leave empty while the era is still going on.',
    lifeEraEmoji: 'Emoji',
    lifeEraUseColor: 'Give it a colour',
    lifeEraColor: 'Colour',
    lifeEraNote: 'Note',
    lifeEraAdd: 'Add era',
    lifeEraSaveChanges: 'Save changes',
    lifeEraEdit: 'Edit {name}',
    lifeEraDelete: 'Delete {name}',
    lifeEraDeleteTitle: 'Delete life era?',
    lifeEraDeleteMessage: '“{name}” will be removed. Your entries stay as they are, and saved searches filtered by it will show every date.',
    lifeEraAdded: 'Added “{name}”.',
    lifeEraUpdated: 'Saved “{name}”.',
    lifeEraDeleted: 'Deleted “{name}”.',
    lifeEraNameRequired: 'Enter a name for this era.',
    lifeEraStartRequired: 'Enter the date this era starts.',
    lifeEraEndBeforeStart: 'The end date must be on or after the start date.',
    lifeEraSaveFailed: 'The life era could not be saved. Try again.',
    lifeEraDeleteFailed: 'The life era could not be deleted. Try again.',
    lifeEraRange: '{start} – {end}',
    lifeEraSince: 'Since {start}',
    eraFilterLabel: 'Life era',
    eraFilterAll: 'All eras',
    eraFilterManage: 'Manage life eras',
    calendarEraShowing: 'Life era: {name} ({range})',
    calendarEraGoToStart: 'Go to the start of {name}',
    bookChapterModeEras: 'Life eras',
    bookIncludeOutsideEras: 'Add an “Other” chapter for entries outside every era',
    bookErasHint: 'One chapter per life era from your profile, in date order. An entry in overlapping eras goes to the shortest one.',
    memoirEraToday: 'This answer is dated today, during {eras}.',
    memoirEraLabel: 'Life era this memory belongs to',
    memoirEraNone: 'None',
    memoirEraHelp: 'The answer is also tagged with the era’s name, so the tag filter finds it.',
  },
  fr: {
    lifeEras: 'Périodes de vie',
    lifeErasIntro: 'Nommez les chapitres de votre vie, comme « Les études » ou « Les années parisiennes ». Filtrez le journal par période, faites un livre avec un chapitre pour chacune et rattachez-y vos réponses de mémoires. Les périodes peuvent se chevaucher.',
    lifeErasCount: '{count} périodes sur {limit}',
    lifeErasEmpty: 'Aucune période de vie pour l’instant. Ajoutez la première ci-dessous.',
    lifeErasLoading: 'Chargement des périodes de vie…',
    lifeErasLoadFailed: 'Les périodes de vie n’ont pas pu être chargées.',
    lifeErasLimitReached: 'Vous avez atteint la limite de {limit} périodes de vie. Supprimez-en une pour en ajouter une autre.',
    lifeEraAddTitle: 'Ajouter une période de vie',
    lifeEraEditTitle: 'Modifier « {name} »',
    lifeEraName: 'Nom',
    lifeEraNamePlaceholder: 'Les études',
    lifeEraStart: 'Date de début',
    lifeEraEnd: 'Date de fin',
    lifeEraEndHelp: 'Laissez vide tant que la période continue.',
    lifeEraEmoji: 'Émoji',
    lifeEraUseColor: 'Lui donner une couleur',
    lifeEraColor: 'Couleur',
    lifeEraNote: 'Note',
    lifeEraAdd: 'Ajouter la période',
    lifeEraSaveChanges: 'Enregistrer les modifications',
    lifeEraEdit: 'Modifier {name}',
    lifeEraDelete: 'Supprimer {name}',
    lifeEraDeleteTitle: 'Supprimer la période de vie ?',
    lifeEraDeleteMessage: '« {name} » sera supprimée. Vos entrées restent telles quelles, et les recherches enregistrées filtrées par cette période afficheront toutes les dates.',
    lifeEraAdded: '« {name} » ajoutée.',
    lifeEraUpdated: '« {name} » enregistrée.',
    lifeEraDeleted: '« {name} » supprimée.',
    lifeEraNameRequired: 'Saisissez un nom pour cette période.',
    lifeEraStartRequired: 'Saisissez la date de début de cette période.',
    lifeEraEndBeforeStart: 'La date de fin doit être égale ou postérieure à la date de début.',
    lifeEraSaveFailed: 'La période de vie n’a pas pu être enregistrée. Réessayez.',
    lifeEraDeleteFailed: 'La période de vie n’a pas pu être supprimée. Réessayez.',
    lifeEraRange: '{start} – {end}',
    lifeEraSince: 'Depuis le {start}',
    eraFilterLabel: 'Période de vie',
    eraFilterAll: 'Toutes les périodes',
    eraFilterManage: 'Gérer les périodes de vie',
    calendarEraShowing: 'Période de vie : {name} ({range})',
    calendarEraGoToStart: 'Aller au début de {name}',
    bookChapterModeEras: 'Périodes de vie',
    bookIncludeOutsideEras: 'Ajouter un dernier chapitre pour les entrées hors de toute période',
    bookErasHint: 'Un chapitre par période de vie de votre profil, dans l’ordre des dates. Une entrée dans des périodes qui se chevauchent va dans la plus courte.',
    memoirEraToday: 'Cette réponse est datée d’aujourd’hui, pendant {eras}.',
    memoirEraLabel: 'Période de vie de ce souvenir',
    memoirEraNone: 'Aucune',
    memoirEraHelp: 'La réponse reçoit aussi le nom de la période comme étiquette, pour la retrouver avec le filtre d’étiquettes.',
  },
};
