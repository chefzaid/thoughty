import type { Language } from './translations';

/** Simple memoir mode: one large question with a record button, and its switch on the Memoir page. */
export type MemoirSimpleTranslationKey =
  | 'memoirSimpleEyebrow'
  | 'memoirSimpleListen'
  | 'memoirSimpleSave'
  | 'memoirSimpleRecordAgain'
  | 'memoirSimpleWriteInstead'
  | 'memoirSimpleThanksTitle'
  | 'memoirSimpleSaved'
  | 'memoirSimpleAnswered'
  | 'memoirSimpleNextOn'
  | 'memoirSimpleNextQuestion'
  | 'memoirSimpleSetAside'
  | 'memoirSimpleComplete'
  | 'memoirSimpleNotStarted'
  | 'memoirSimpleNoDiary'
  | 'memoirSimpleFullApp'
  | 'memoirSimpleModeTitle'
  | 'memoirSimpleModeDescription'
  | 'memoirSimpleModeSetting'
  | 'memoirSimpleModeOpen';

export const memoirSimpleTranslations: Record<Language, Record<MemoirSimpleTranslationKey, string>> = {
  en: {
    memoirSimpleEyebrow: 'Your memoir',
    memoirSimpleListen: 'Listen to your answer',
    memoirSimpleSave: 'Save my answer',
    memoirSimpleRecordAgain: 'Record again',
    memoirSimpleWriteInstead: 'Recording is not available here. You can write your answer instead.',
    memoirSimpleThanksTitle: 'Thank you',
    memoirSimpleSaved: 'Your answer is saved in your memoir.',
    memoirSimpleAnswered: 'You have answered this week’s question.',
    memoirSimpleNextOn: 'Your next question comes on {date}.',
    memoirSimpleNextQuestion: 'Answer this week’s question',
    memoirSimpleSetAside: 'There is no question for now. The next one comes on {date}.',
    memoirSimpleComplete: 'You have answered every question. Thank you for telling your story.',
    memoirSimpleNotStarted: 'Your memoir has not started yet. Start it from the full app.',
    memoirSimpleNoDiary: 'Your memoir diary was deleted. Choose another one in the full app to keep answering.',
    memoirSimpleFullApp: 'Open the full app',
    memoirSimpleModeTitle: 'Simple mode',
    memoirSimpleModeDescription: 'One large question at a time with a single record button, and nothing else of the app. For someone who only wants to answer.',
    memoirSimpleModeSetting: 'Open in simple mode when signing in and from the weekly email',
    memoirSimpleModeOpen: 'Open simple mode',
  },
  fr: {
    memoirSimpleEyebrow: 'Vos mémoires',
    memoirSimpleListen: 'Réécouter votre réponse',
    memoirSimpleSave: 'Garder ma réponse',
    memoirSimpleRecordAgain: 'Recommencer',
    memoirSimpleWriteInstead: 'L’enregistrement n’est pas disponible ici. Vous pouvez écrire votre réponse à la place.',
    memoirSimpleThanksTitle: 'Merci',
    memoirSimpleSaved: 'Votre réponse est gardée dans vos mémoires.',
    memoirSimpleAnswered: 'Vous avez répondu à la question de la semaine.',
    memoirSimpleNextOn: 'Votre prochaine question arrive le {date}.',
    memoirSimpleNextQuestion: 'Répondre à la question de la semaine',
    memoirSimpleSetAside: 'Pas de question pour l’instant. La prochaine arrive le {date}.',
    memoirSimpleComplete: 'Vous avez répondu à toutes les questions. Merci d’avoir raconté votre histoire.',
    memoirSimpleNotStarted: 'Vos mémoires n’ont pas encore commencé. Lancez-les depuis l’application complète.',
    memoirSimpleNoDiary: 'Votre journal de mémoires a été supprimé. Choisissez-en un autre dans l’application complète pour continuer à répondre.',
    memoirSimpleFullApp: 'Ouvrir l’application complète',
    memoirSimpleModeTitle: 'Mode simple',
    memoirSimpleModeDescription: 'Une seule grande question à la fois, un seul bouton pour enregistrer, et rien d’autre de l’application. Pour qui veut seulement répondre.',
    memoirSimpleModeSetting: 'Ouvrir en mode simple à la connexion et depuis l’e-mail de la semaine',
    memoirSimpleModeOpen: 'Ouvrir le mode simple',
  },
};
