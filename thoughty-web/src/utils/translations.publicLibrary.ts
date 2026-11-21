import type { Language } from './translations';

/** The public pages that show the memoir questions and the built-in templates to anyone, and their footer links. */
export type PublicLibraryTranslationKey =
  | 'footerMemoirQuestions'
  | 'footerJournalTemplates'
  | 'questionsPageMetaTitle'
  | 'questionsPageMetaDescription'
  | 'questionsPageEyebrow'
  | 'questionsPageTitle'
  | 'questionsPageSubtitle'
  | 'questionsPageYearTitle'
  | 'questionsPageYearCount_one'
  | 'questionsPageYearCount_other'
  | 'questionsPageThemesTitle'
  | 'questionsPageThemesHint'
  | 'questionsPageLoading'
  | 'questionsPageError'
  | 'questionsPageRetry'
  | 'questionsPageCtaTitle'
  | 'questionsPageCtaBody'
  | 'questionsPageStart'
  | 'questionsPageOpen'
  | 'questionsPageTemplatesLink'
  | 'templatesPageMetaTitle'
  | 'templatesPageMetaDescription'
  | 'templatesPageEyebrow'
  | 'templatesPageTitle'
  | 'templatesPageSubtitle'
  | 'templatesPageListLabel'
  | 'templatesPageTagsLabel'
  | 'templatesPageSeal_one'
  | 'templatesPageSeal_other'
  | 'templatesPageCtaTitle'
  | 'templatesPageCtaBody'
  | 'templatesPageStart'
  | 'templatesPageOpen'
  | 'templatesPageQuestionsLink';

export const publicLibraryTranslations: Record<Language, Record<PublicLibraryTranslationKey, string>> = {
  en: {
    footerMemoirQuestions: 'Memoir questions',
    footerJournalTemplates: 'Journal templates',
    questionsPageMetaTitle: 'Memoir questions to ask your parents, and yourself',
    questionsPageMetaDescription: 'Every question of the Thoughty guided memoir, chapter by chapter from childhood to the lessons of a life, to ask a parent or grandparent or to answer yourself.',
    questionsPageEyebrow: 'Guided memoir',
    questionsPageTitle: 'Questions to ask your parents, and yourself.',
    questionsPageSubtitle: 'Good questions bring back the stories that would otherwise be lost. Ask them at the table or on a phone call, or answer them yourself, one a week.',
    questionsPageYearTitle: 'A year of questions',
    questionsPageYearCount_one: '{count} question, one a week, in the order of a life.',
    questionsPageYearCount_other: '{count} questions, one a week, in the order of a life.',
    questionsPageThemesTitle: 'Themes to add',
    questionsPageThemesHint: 'Chapters a writer adds to their year when they belong to the story.',
    questionsPageLoading: 'Loading the questions...',
    questionsPageError: 'The questions could not be loaded. Try again in a moment.',
    questionsPageRetry: 'Try again',
    questionsPageCtaTitle: 'Turn the answers into a book',
    questionsPageCtaBody: 'Thoughty brings one question a week, keeps every answer private, and turns the answers into a book to print or share.',
    questionsPageStart: 'Start your memoir',
    questionsPageOpen: 'Open your memoir',
    questionsPageTemplatesLink: 'Keeping a daily journal instead? See the journal templates',
    templatesPageMetaTitle: 'Journal templates and prompts',
    templatesPageMetaDescription: 'Free journal templates from Thoughty: gratitude, daily reflection, morning intentions, weekly review, decision notes, a letter to your future self and more, each with its prompts.',
    templatesPageEyebrow: 'Journal templates',
    templatesPageTitle: 'Journal templates for the days you do not know where to start.',
    templatesPageSubtitle: 'Each template opens a new entry with a few prompts to answer, from a short gratitude list to a letter to your future self.',
    templatesPageListLabel: 'Templates',
    templatesPageTagsLabel: 'Tags',
    templatesPageSeal_one: 'Offers to seal the entry as a time capsule for {count} year.',
    templatesPageSeal_other: 'Offers to seal the entry as a time capsule for {count} years.',
    templatesPageCtaTitle: 'Write with a template',
    templatesPageCtaBody: 'Pick one when you write an entry, make one the default of a diary, or write your own.',
    templatesPageStart: 'Start your journal',
    templatesPageOpen: 'Open your journal',
    templatesPageQuestionsLink: 'Writing a life story? See the memoir questions',
  },
  fr: {
    footerMemoirQuestions: 'Questions de mémoires',
    footerJournalTemplates: 'Modèles de journal',
    questionsPageMetaTitle: 'Questions à poser à vos parents, et à vous-même',
    questionsPageMetaDescription: 'Toutes les questions des mémoires guidés de Thoughty, chapitre par chapitre de l’enfance aux leçons d’une vie, à poser à un parent ou à un grand-parent, ou à vous-même.',
    questionsPageEyebrow: 'Mémoires guidés',
    questionsPageTitle: 'Des questions à poser à vos parents, et à vous-même.',
    questionsPageSubtitle: 'Les bonnes questions font revenir les histoires qui se perdraient sinon. Posez-les à table ou au téléphone, ou répondez-y vous-même, une par semaine.',
    questionsPageYearTitle: 'Une année de questions',
    questionsPageYearCount_one: '{count} question, une par semaine, dans l’ordre d’une vie.',
    questionsPageYearCount_other: '{count} questions, une par semaine, dans l’ordre d’une vie.',
    questionsPageThemesTitle: 'Thèmes à ajouter',
    questionsPageThemesHint: 'Des chapitres que l’on ajoute à son année quand ils font partie de son histoire.',
    questionsPageLoading: 'Chargement des questions...',
    questionsPageError: 'Les questions n’ont pas pu être chargées. Réessayez dans un instant.',
    questionsPageRetry: 'Réessayer',
    questionsPageCtaTitle: 'Faites de vos réponses un livre',
    questionsPageCtaBody: 'Thoughty apporte une question par semaine, garde chaque réponse privée et fait de vos réponses un livre à imprimer ou à partager.',
    questionsPageStart: 'Commencer vos mémoires',
    questionsPageOpen: 'Ouvrir vos mémoires',
    questionsPageTemplatesLink: 'Vous tenez plutôt un journal quotidien ? Voir les modèles de journal',
    templatesPageMetaTitle: 'Modèles et pistes d’écriture pour votre journal',
    templatesPageMetaDescription: 'Des modèles de journal gratuits par Thoughty : journal de gratitude, réflexion du jour, intentions du matin, bilan de la semaine, notes de décision, lettre à mon moi futur et d’autres, chacun avec ses pistes d’écriture.',
    templatesPageEyebrow: 'Modèles de journal',
    templatesPageTitle: 'Des modèles de journal pour les jours où l’on ne sait pas par où commencer.',
    templatesPageSubtitle: 'Chaque modèle ouvre une nouvelle entrée avec quelques pistes auxquelles répondre, d’une courte liste de gratitude à une lettre à votre moi futur.',
    templatesPageListLabel: 'Modèles',
    templatesPageTagsLabel: 'Tags',
    templatesPageSeal_one: 'Propose de sceller l’entrée en capsule temporelle pour {count} an.',
    templatesPageSeal_other: 'Propose de sceller l’entrée en capsule temporelle pour {count} ans.',
    templatesPageCtaTitle: 'Écrivez à partir d’un modèle',
    templatesPageCtaBody: 'Choisissez-en un en écrivant une entrée, faites-en le modèle par défaut d’un journal, ou créez le vôtre.',
    templatesPageStart: 'Commencer votre journal',
    templatesPageOpen: 'Ouvrir votre journal',
    templatesPageQuestionsLink: 'Vous écrivez l’histoire d’une vie ? Voir les questions de mémoires',
  },
};
