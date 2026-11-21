import type { Language } from './translations';

/** The first-run welcome page: what the writer is here for, and a first template for a daily journal. */
export type WelcomeTranslationKey =
  | 'welcomeTitle'
  | 'welcomeSubtitle'
  | 'welcomeChoicesLabel'
  | 'welcomeJournalTitle'
  | 'welcomeJournalBody'
  | 'welcomeMemoirTitle'
  | 'welcomeMemoirBody'
  | 'welcomeImportTitle'
  | 'welcomeImportBody'
  | 'welcomeSkip'
  | 'welcomeTemplateTitle'
  | 'welcomeTemplateHint'
  | 'welcomeTemplateBlank'
  | 'welcomeTemplateBlankBody'
  | 'welcomeStartWriting'
  | 'welcomeTemplateBack'
  | 'welcomeSaving';

export const welcomeTranslations: Record<Language, Record<WelcomeTranslationKey, string>> = {
  en: {
    welcomeTitle: 'Welcome to Thoughty',
    welcomeSubtitle: 'What brings you here? Pick one to start in the right place; everything else stays a click away.',
    welcomeChoicesLabel: 'What brings you here?',
    welcomeJournalTitle: 'A daily journal',
    welcomeJournalBody: 'Write a few lines a day, starting from a template if you like.',
    welcomeMemoirTitle: 'My life story',
    welcomeMemoirBody: 'Answer one question a week, then turn your answers into a book.',
    welcomeImportTitle: 'Coming from another app',
    welcomeImportBody: 'Bring your entries over from Day One, Journey, daily notes (Obsidian, Logseq) or Google Keep.',
    welcomeSkip: 'Skip and open my journal',
    welcomeTemplateTitle: 'Pick a first template',
    welcomeTemplateHint: 'A new entry in {diary} starts from it while the composer is empty. You can change it any time in Manage Diaries.',
    welcomeTemplateBlank: 'A blank page',
    welcomeTemplateBlankBody: 'No template: every entry starts empty.',
    welcomeStartWriting: 'Start writing',
    welcomeTemplateBack: 'Back',
    welcomeSaving: 'Saving...',
  },
  fr: {
    welcomeTitle: 'Bienvenue sur Thoughty',
    welcomeSubtitle: 'Qu’est-ce qui vous amène ? Choisissez pour commencer au bon endroit ; tout le reste reste à un clic.',
    welcomeChoicesLabel: 'Qu’est-ce qui vous amène ?',
    welcomeJournalTitle: 'Un journal quotidien',
    welcomeJournalBody: 'Écrivez quelques lignes par jour, à partir d’un modèle si vous le souhaitez.',
    welcomeMemoirTitle: 'L’histoire de ma vie',
    welcomeMemoirBody: 'Répondez à une question par semaine, puis faites de vos réponses un livre.',
    welcomeImportTitle: 'Je viens d’une autre application',
    welcomeImportBody: 'Reprenez vos entrées de Day One, Journey, de notes quotidiennes (Obsidian, Logseq) ou de Google Keep.',
    welcomeSkip: 'Passer et ouvrir mon journal',
    welcomeTemplateTitle: 'Choisissez un premier modèle',
    welcomeTemplateHint: 'Une nouvelle entrée de {diary} part de ce modèle quand l’éditeur est vide. Vous pouvez le changer à tout moment dans Gérer les journaux.',
    welcomeTemplateBlank: 'Une page blanche',
    welcomeTemplateBlankBody: 'Aucun modèle : chaque entrée commence vide.',
    welcomeStartWriting: 'Commencer à écrire',
    welcomeTemplateBack: 'Retour',
    welcomeSaving: 'Enregistrement...',
  },
};
