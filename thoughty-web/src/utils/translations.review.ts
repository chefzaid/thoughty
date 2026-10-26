import type { Language } from './translations';

export type ReviewTranslationKey =
  | 'reviewTitle'
  | 'reviewTeaserTitle'
  | 'reviewTeaserBody'
  | 'reviewTeaserAction'
  | 'reviewYearLabel'
  | 'reviewScopeLabel'
  | 'reviewLoading'
  | 'reviewLoadError'
  | 'reviewRetry'
  | 'reviewEmptyJournal'
  | 'reviewEmptyYear'
  | 'reviewStatEntries'
  | 'reviewStatWords'
  | 'reviewStatDays'
  | 'reviewStatStreak'
  | 'reviewStatFavorites'
  | 'reviewStatFiles'
  | 'reviewEntries_one'
  | 'reviewEntries_other'
  | 'reviewWords_one'
  | 'reviewWords_other'
  | 'reviewDays_one'
  | 'reviewDays_other'
  | 'reviewCompared'
  | 'reviewAverageWords_one'
  | 'reviewAverageWords_other'
  | 'reviewMonthsTitle'
  | 'reviewBusiestMonth'
  | 'reviewMonthBar'
  | 'reviewRhythmTitle'
  | 'reviewBusiestWeekday'
  | 'reviewWeekdayBar'
  | 'reviewThemesTitle'
  | 'reviewThemesEmpty'
  | 'reviewNewTags'
  | 'reviewHighlightsTitle'
  | 'reviewHighlightFirst'
  | 'reviewHighlightFavorite'
  | 'reviewHighlightLongest'
  | 'reviewHighlightLast'
  | 'reviewReadEntry'
  | 'reviewMoodTitle'
  | 'reviewMoodIntro'
  | 'reviewMoodPrivacy'
  | 'reviewMoodAction'
  | 'reviewMoodReading'
  | 'reviewMoodAgain'
  | 'reviewMoodGenerated'
  | 'reviewMoodUnavailable'
  | 'reviewMoodError'
  | 'reviewMoodChartLabel'
  | 'reviewShareTitle'
  | 'reviewPrivateNote'
  | 'reviewShareAction'
  | 'reviewShareLabel'
  | 'reviewShareIncludeThemes'
  | 'reviewShareHint'
  | 'reviewSharePost'
  | 'reviewSharePosting'
  | 'reviewSharePosted'
  | 'reviewShareOpen'
  | 'reviewShareError'
  | 'reviewShareText'
  | 'reviewShareThemes'
  | 'reviewPrint';

export const reviewTranslations: Record<Language, Record<ReviewTranslationKey, string>> = {
  en: {
    reviewTitle: 'Your {year} in review',
    reviewTeaserTitle: 'Your year in review',
    reviewTeaserBody: 'Totals, themes, the moments worth rereading, and the mood of your year. It stays private unless you share it.',
    reviewTeaserAction: 'Open the year in review',
    reviewYearLabel: 'Year',
    reviewScopeLabel: 'Diaries',
    reviewLoading: 'Gathering your year…',
    reviewLoadError: 'The year in review could not be loaded.',
    reviewRetry: 'Try again',
    reviewEmptyJournal: 'Write your first entry to start your year in review.',
    reviewEmptyYear: 'No entries in {year} in this selection.',
    reviewStatEntries: 'Entries',
    reviewStatWords: 'Words',
    reviewStatDays: 'Writing days',
    reviewStatStreak: 'Longest streak (days)',
    reviewStatFavorites: 'Favorites',
    reviewStatFiles: 'Photos and files',
    reviewEntries_one: '{count} entry',
    reviewEntries_other: '{count} entries',
    reviewWords_one: '{count} word',
    reviewWords_other: '{count} words',
    reviewDays_one: '{count} day',
    reviewDays_other: '{count} days',
    reviewCompared: '{change} vs {year}',
    reviewAverageWords_one: 'Average entry length: {count} word',
    reviewAverageWords_other: 'Average entry length: {count} words',
    reviewMonthsTitle: 'Month by month',
    reviewBusiestMonth: 'Your busiest month was {month}, with {entries}.',
    reviewMonthBar: '{month}: {entries}, {words}',
    reviewRhythmTitle: 'When you write',
    reviewBusiestWeekday: 'You wrote most often on {weekday}.',
    reviewWeekdayBar: '{weekday}: {entries}',
    reviewThemesTitle: 'What filled your pages',
    reviewThemesEmpty: 'No tags this year.',
    reviewNewTags: 'New this year',
    reviewHighlightsTitle: 'Moments to reread',
    reviewHighlightFirst: 'First entry of the year',
    reviewHighlightFavorite: 'A favorite',
    reviewHighlightLongest: 'Your longest entry',
    reviewHighlightLast: 'Last entry of the year',
    reviewReadEntry: 'Read in journal',
    reviewMoodTitle: 'The mood of your year',
    reviewMoodIntro: 'Let AI read how each month felt, from a sample of your entries.',
    reviewMoodPrivacy: 'Only when you ask: up to five entries a month, their first 600 characters, go to the AI provider. The reading is kept with your review until you ask again.',
    reviewMoodAction: 'Read the mood of my year',
    reviewMoodReading: 'Reading your year…',
    reviewMoodAgain: 'Read it again',
    reviewMoodGenerated: 'Read on {date} from {entries}',
    reviewMoodUnavailable: 'Add an OpenRouter key in your profile to read the mood of your year.',
    reviewMoodError: 'The mood of your year could not be read right now. Try again later.',
    reviewMoodChartLabel: 'Mood by month, from low to bright: {moods}',
    reviewShareTitle: 'Share or keep',
    reviewPrivateNote: 'This review is private. Nothing is shared unless you post it.',
    reviewShareAction: 'Share a summary',
    reviewShareLabel: 'Post text',
    reviewShareIncludeThemes: 'Include my top themes',
    reviewShareHint: 'Only this text is posted, as a public entry in your journal. You can edit or delete it at any time.',
    reviewSharePost: 'Post to the public feed',
    reviewSharePosting: 'Posting…',
    reviewSharePosted: 'Posted to the public feed.',
    reviewShareOpen: 'See the post',
    reviewShareError: 'The post could not be published.',
    reviewShareText: 'My {year} in Thoughty: {entries} and {words} over {days}, with a longest streak of {streak}.',
    reviewShareThemes: 'Most on my mind: {tags}.',
    reviewPrint: 'Print or save as PDF',
  },
  fr: {
    reviewTitle: 'Votre année {year}',
    reviewTeaserTitle: 'Votre bilan de l’année',
    reviewTeaserBody: 'Les chiffres, les thèmes, les moments à relire et l’humeur de votre année. Il reste privé, sauf si vous le partagez.',
    reviewTeaserAction: 'Ouvrir le bilan de l’année',
    reviewYearLabel: 'Année',
    reviewScopeLabel: 'Journaux',
    reviewLoading: 'Préparation de votre bilan…',
    reviewLoadError: 'Le bilan de l’année n’a pas pu être chargé.',
    reviewRetry: 'Réessayer',
    reviewEmptyJournal: 'Écrivez votre première entrée pour commencer votre bilan de l’année.',
    reviewEmptyYear: 'Aucune entrée en {year} dans cette sélection.',
    reviewStatEntries: 'Entrées',
    reviewStatWords: 'Mots',
    reviewStatDays: 'Jours d’écriture',
    reviewStatStreak: 'Plus longue série (jours)',
    reviewStatFavorites: 'Favoris',
    reviewStatFiles: 'Photos et fichiers',
    reviewEntries_one: '{count} entrée',
    reviewEntries_other: '{count} entrées',
    reviewWords_one: '{count} mot',
    reviewWords_other: '{count} mots',
    reviewDays_one: '{count} jour',
    reviewDays_other: '{count} jours',
    reviewCompared: '{change} par rapport à {year}',
    reviewAverageWords_one: 'Longueur moyenne d’une entrée : {count} mot',
    reviewAverageWords_other: 'Longueur moyenne d’une entrée : {count} mots',
    reviewMonthsTitle: 'Mois par mois',
    reviewBusiestMonth: 'Votre mois le plus riche : {month}, avec {entries}.',
    reviewMonthBar: '{month} : {entries}, {words}',
    reviewRhythmTitle: 'Quand vous écrivez',
    reviewBusiestWeekday: 'Vous avez le plus écrit le {weekday}.',
    reviewWeekdayBar: '{weekday} : {entries}',
    reviewThemesTitle: 'Ce qui a rempli vos pages',
    reviewThemesEmpty: 'Aucun tag cette année.',
    reviewNewTags: 'Nouveaux cette année',
    reviewHighlightsTitle: 'Des moments à relire',
    reviewHighlightFirst: 'Première entrée de l’année',
    reviewHighlightFavorite: 'Un favori',
    reviewHighlightLongest: 'Votre plus longue entrée',
    reviewHighlightLast: 'Dernière entrée de l’année',
    reviewReadEntry: 'Lire dans le journal',
    reviewMoodTitle: 'L’humeur de votre année',
    reviewMoodIntro: 'Laissez l’IA lire le ton de chaque mois, à partir d’un échantillon de vos entrées.',
    reviewMoodPrivacy: 'Uniquement à votre demande : jusqu’à cinq entrées par mois, leurs 600 premiers caractères, sont envoyées au fournisseur d’IA. La lecture est gardée avec votre bilan jusqu’à la prochaine demande.',
    reviewMoodAction: 'Lire l’humeur de mon année',
    reviewMoodReading: 'Lecture de votre année…',
    reviewMoodAgain: 'Relire',
    reviewMoodGenerated: 'Lue le {date} à partir de {entries}',
    reviewMoodUnavailable: 'Ajoutez une clé OpenRouter dans votre profil pour lire l’humeur de votre année.',
    reviewMoodError: 'L’humeur de votre année n’a pas pu être lue pour le moment. Réessayez plus tard.',
    reviewMoodChartLabel: 'Humeur par mois, de sombre à lumineuse : {moods}',
    reviewShareTitle: 'Partager ou garder',
    reviewPrivateNote: 'Ce bilan est privé. Rien n’est partagé sans publication de votre part.',
    reviewShareAction: 'Partager un résumé',
    reviewShareLabel: 'Texte de la publication',
    reviewShareIncludeThemes: 'Inclure mes thèmes principaux',
    reviewShareHint: 'Seul ce texte est publié, comme entrée publique de votre journal. Vous pouvez le modifier ou le supprimer à tout moment.',
    reviewSharePost: 'Publier dans le fil public',
    reviewSharePosting: 'Publication…',
    reviewSharePosted: 'Publié dans le fil public.',
    reviewShareOpen: 'Voir la publication',
    reviewShareError: 'La publication a échoué.',
    reviewShareText: 'Mon année {year} sur Thoughty : {entries} et {words} sur {days}, avec une plus longue série de {streak}.',
    reviewShareThemes: 'Ce qui m’a le plus occupé : {tags}.',
    reviewPrint: 'Imprimer ou enregistrer en PDF',
  },
};
