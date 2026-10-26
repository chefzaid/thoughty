import type { Language } from './translations';

export type MemoirTranslationKey =
  | 'memoir'
  | 'memoirTagline'
  | 'memoirIntroTitle'
  | 'memoirIntroBody'
  | 'memoirIntroStats'
  | 'memoirStartTitle'
  | 'memoirDiaryLabel'
  | 'memoirNewDiaryOption'
  | 'memoirDiaryNameLabel'
  | 'memoirDefaultDiaryName'
  | 'memoirWeeklyEmail'
  | 'memoirWeekdayLabel'
  | 'memoirDeliveryHint'
  | 'memoirStart'
  | 'memoirStarting'
  | 'memoirStartError'
  | 'memoirLoadError'
  | 'memoirThisWeek'
  | 'memoirAnswerQuestion'
  | 'memoirSkip'
  | 'memoirAnswered'
  | 'memoirOpenAnswer'
  | 'memoirAnsweredThisWeek'
  | 'memoirNextQuestion'
  | 'memoirComplete'
  | 'memoirPausedNotice'
  | 'memoirEmailUnavailable'
  | 'memoirNoDiary'
  | 'memoirYourAnswer'
  | 'memoirAnswerPlaceholder'
  | 'memoirPrivateNote'
  | 'memoirRecord'
  | 'memoirStopRecording'
  | 'memoirRecordingTime'
  | 'memoirRecordingReady'
  | 'memoirDiscardRecording'
  | 'memoirUploadRecording'
  | 'memoirTranscribe'
  | 'memoirTranscribing'
  | 'memoirTranscribeError'
  | 'memoirMicrophoneError'
  | 'memoirRecordingTooLarge'
  | 'memoirUploadError'
  | 'memoirSaveAnswer'
  | 'memoirSaving'
  | 'memoirAnswerSaved'
  | 'memoirAnswerEmpty'
  | 'memoirAnswerError'
  | 'memoirProgressTitle'
  | 'memoirAnsweredCount'
  | 'memoirWords'
  | 'memoirPages'
  | 'memoirChaptersStarted'
  | 'memoirChapterProgress'
  | 'memoirMakeBook'
  | 'memoirAllQuestions'
  | 'memoirAllQuestionsHint'
  | 'memoirThisWeekBadge'
  | 'memoirSettings'
  | 'memoirSaveSettings'
  | 'memoirSettingsSaved'
  | 'memoirSaveError'
  | 'memoirPause'
  | 'memoirResume'
  | 'memoirLeave'
  | 'memoirLeaveTitle'
  | 'memoirLeaveMessage';

export const memoirTranslations: Record<Language, Record<MemoirTranslationKey, string>> = {
  en: {
    memoir: 'Memoir',
    memoirTagline: 'Tell your life story, one question a week.',
    memoirIntroTitle: 'Your life story, written one week at a time',
    memoirIntroBody:
      'Every week, Thoughty asks you one question about your childhood, your family, love and friendship, your work, the places you have lived, and the lessons life has taught you. Write or record your answers: they stay private in your memoir diary and become the chapters of a book you can keep or pass on.',
    memoirIntroStats: '{questions} questions in {chapters} chapters',
    memoirStartTitle: 'Start your memoir',
    memoirDiaryLabel: 'Where should your answers go?',
    memoirNewDiaryOption: 'A new private diary',
    memoirDiaryNameLabel: 'Diary name',
    memoirDefaultDiaryName: 'My memoir',
    memoirWeeklyEmail: 'Email me each week’s question',
    memoirWeekdayLabel: 'New question every',
    memoirDeliveryHint: 'Questions arrive at 9:00 in your time zone ({timeZone}).',
    memoirStart: 'Start my memoir',
    memoirStarting: 'Starting…',
    memoirStartError: 'Your memoir could not be started.',
    memoirLoadError: 'Your memoir could not be loaded.',
    memoirThisWeek: 'This week’s question',
    memoirAnswerQuestion: 'Answer',
    memoirSkip: 'Another question',
    memoirAnswered: 'Answered',
    memoirOpenAnswer: 'Read in journal',
    memoirAnsweredThisWeek: 'You have answered this week’s question. The next one arrives on {date}.',
    memoirNextQuestion: 'Next question: {date}',
    memoirComplete: 'You have answered every question. Your memoir is ready to become a book.',
    memoirPausedNotice: 'Weekly questions are paused.',
    memoirEmailUnavailable: 'Weekly emails cannot reach you yet, so find each new question here.',
    memoirNoDiary: 'Your memoir diary was deleted. Choose a diary in the settings below to keep answering.',
    memoirYourAnswer: 'Your answer',
    memoirAnswerPlaceholder: 'Take your time, and write it the way you would tell it.',
    memoirPrivateNote: 'Answers are saved as private entries in your memoir diary.',
    memoirRecord: 'Record my answer',
    memoirStopRecording: 'Stop recording',
    memoirRecordingTime: 'Recording {time}',
    memoirRecordingReady: 'Recording ready ({detail})',
    memoirDiscardRecording: 'Remove recording',
    memoirUploadRecording: 'Upload a recording',
    memoirTranscribe: 'Turn the recording into text',
    memoirTranscribing: 'Transcribing…',
    memoirTranscribeError: 'The recording could not be turned into text. You can still save it with your answer.',
    memoirMicrophoneError: 'The microphone is not available. Check the browser permission, or upload a recording instead.',
    memoirRecordingTooLarge: 'Recordings are limited to 5 MB.',
    memoirUploadError: 'The recording could not be uploaded.',
    memoirSaveAnswer: 'Save answer',
    memoirSaving: 'Saving…',
    memoirAnswerSaved: 'Answer saved to your memoir.',
    memoirAnswerEmpty: 'Write an answer or record one first.',
    memoirAnswerError: 'Your answer could not be saved.',
    memoirProgressTitle: 'Your progress',
    memoirAnsweredCount: '{answered} of {total} questions answered',
    memoirWords: 'Words',
    memoirPages: 'Book pages (estimate)',
    memoirChaptersStarted: 'Chapters started',
    memoirChapterProgress: '{chapter}: {answered} of {total} answered',
    memoirMakeBook: 'Turn my memoir into a book',
    memoirAllQuestions: 'All questions',
    memoirAllQuestionsHint: 'Answer any question, in any order.',
    memoirThisWeekBadge: 'This week',
    memoirSettings: 'Memoir settings',
    memoirSaveSettings: 'Save settings',
    memoirSettingsSaved: 'Settings saved.',
    memoirSaveError: 'The change could not be saved.',
    memoirPause: 'Pause weekly questions',
    memoirResume: 'Resume weekly questions',
    memoirLeave: 'Stop the memoir',
    memoirLeaveTitle: 'Stop the guided memoir?',
    memoirLeaveMessage:
      'Weekly questions and emails stop. Your answers stay in your journal, and they count again if you start the memoir later.',
  },
  fr: {
    memoir: 'Mémoires',
    memoirTagline: 'Racontez l’histoire de votre vie, une question par semaine.',
    memoirIntroTitle: 'L’histoire de votre vie, écrite semaine après semaine',
    memoirIntroBody:
      'Chaque semaine, Thoughty vous pose une question sur votre enfance, votre famille, l’amour et l’amitié, votre travail, les lieux où vous avez vécu et les leçons que la vie vous a apprises. Écrivez ou enregistrez vos réponses : elles restent privées dans votre journal de mémoires et deviennent les chapitres d’un livre à garder ou à transmettre.',
    memoirIntroStats: '{questions} questions en {chapters} chapitres',
    memoirStartTitle: 'Commencer vos mémoires',
    memoirDiaryLabel: 'Où ranger vos réponses ?',
    memoirNewDiaryOption: 'Un nouveau journal privé',
    memoirDiaryNameLabel: 'Nom du journal',
    memoirDefaultDiaryName: 'Mes mémoires',
    memoirWeeklyEmail: 'M’envoyer la question de chaque semaine par e-mail',
    memoirWeekdayLabel: 'Nouvelle question chaque',
    memoirDeliveryHint: 'Les questions arrivent à 9 h dans votre fuseau horaire ({timeZone}).',
    memoirStart: 'Commencer mes mémoires',
    memoirStarting: 'Démarrage…',
    memoirStartError: 'Vos mémoires n’ont pas pu être commencées.',
    memoirLoadError: 'Vos mémoires n’ont pas pu être chargées.',
    memoirThisWeek: 'La question de la semaine',
    memoirAnswerQuestion: 'Répondre',
    memoirSkip: 'Une autre question',
    memoirAnswered: 'Répondu',
    memoirOpenAnswer: 'Lire dans le journal',
    memoirAnsweredThisWeek: 'Vous avez répondu à la question de la semaine. La prochaine arrive le {date}.',
    memoirNextQuestion: 'Prochaine question : {date}',
    memoirComplete: 'Vous avez répondu à toutes les questions. Vos mémoires sont prêtes à devenir un livre.',
    memoirPausedNotice: 'Les questions hebdomadaires sont en pause.',
    memoirEmailUnavailable: 'Les e-mails hebdomadaires ne peuvent pas encore vous parvenir : retrouvez chaque nouvelle question ici.',
    memoirNoDiary: 'Votre journal de mémoires a été supprimé. Choisissez un journal dans les réglages ci-dessous pour continuer à répondre.',
    memoirYourAnswer: 'Votre réponse',
    memoirAnswerPlaceholder: 'Prenez votre temps, et écrivez-le comme vous le raconteriez.',
    memoirPrivateNote: 'Les réponses sont enregistrées comme entrées privées dans votre journal de mémoires.',
    memoirRecord: 'Enregistrer ma réponse à voix haute',
    memoirStopRecording: 'Arrêter l’enregistrement',
    memoirRecordingTime: 'Enregistrement {time}',
    memoirRecordingReady: 'Enregistrement prêt ({detail})',
    memoirDiscardRecording: 'Supprimer l’enregistrement',
    memoirUploadRecording: 'Importer un enregistrement',
    memoirTranscribe: 'Transcrire l’enregistrement en texte',
    memoirTranscribing: 'Transcription…',
    memoirTranscribeError: 'L’enregistrement n’a pas pu être transcrit. Vous pouvez quand même le garder avec votre réponse.',
    memoirMicrophoneError: 'Le micro n’est pas disponible. Vérifiez l’autorisation du navigateur, ou importez un enregistrement.',
    memoirRecordingTooLarge: 'Les enregistrements sont limités à 5 Mo.',
    memoirUploadError: 'L’enregistrement n’a pas pu être envoyé.',
    memoirSaveAnswer: 'Enregistrer la réponse',
    memoirSaving: 'Enregistrement…',
    memoirAnswerSaved: 'Réponse ajoutée à vos mémoires.',
    memoirAnswerEmpty: 'Écrivez ou enregistrez d’abord une réponse.',
    memoirAnswerError: 'Votre réponse n’a pas pu être enregistrée.',
    memoirProgressTitle: 'Votre progression',
    memoirAnsweredCount: '{answered} questions répondues sur {total}',
    memoirWords: 'Mots',
    memoirPages: 'Pages du livre (estimation)',
    memoirChaptersStarted: 'Chapitres commencés',
    memoirChapterProgress: '{chapter} : {answered} sur {total} répondues',
    memoirMakeBook: 'Faire de mes mémoires un livre',
    memoirAllQuestions: 'Toutes les questions',
    memoirAllQuestionsHint: 'Répondez à n’importe quelle question, dans l’ordre de votre choix.',
    memoirThisWeekBadge: 'Cette semaine',
    memoirSettings: 'Réglages des mémoires',
    memoirSaveSettings: 'Enregistrer les réglages',
    memoirSettingsSaved: 'Réglages enregistrés.',
    memoirSaveError: 'La modification n’a pas pu être enregistrée.',
    memoirPause: 'Mettre les questions en pause',
    memoirResume: 'Reprendre les questions',
    memoirLeave: 'Arrêter les mémoires',
    memoirLeaveTitle: 'Arrêter les mémoires guidées ?',
    memoirLeaveMessage:
      'Les questions et les e-mails hebdomadaires s’arrêtent. Vos réponses restent dans votre journal et comptent à nouveau si vous reprenez les mémoires plus tard.',
  },
};
