import type { Language } from './translations';

export type DiaryAiTranslationKey =
  | 'diaryAiMode'
  | 'diaryAiModeOn'
  | 'diaryAiModeOff'
  | 'diaryAiModeAsk'
  | 'diaryAiModeHint'
  | 'diaryAiOffSummary'
  | 'diaryAiAskSummary'
  | 'diaryAiOffNotice'
  | 'diaryAiAskNotice'
  | 'diaryAiOffLeftOut'
  | 'aiConsentTitle'
  | 'aiConsentIntro'
  | 'aiConsentProvider'
  | 'aiConsentProviderDefault'
  | 'aiConsentTags'
  | 'aiConsentQuestion'
  | 'aiConsentAskedBefore'
  | 'aiConsentConversation'
  | 'aiConsentYou'
  | 'aiConsentAssistant'
  | 'aiConsentRecordingIntro'
  | 'aiConsentRecordingLength'
  | 'aiConsentTranscriptionProvider'
  | 'aiConsentSend';

/** The AI privacy mode of a diary, in Manage Diaries, what the journal-wide AI actions say of it, and the consent dialog. */
export const diaryAiTranslations: Record<Language, Record<DiaryAiTranslationKey, string>> = {
  en: {
    diaryAiMode: 'AI',
    diaryAiModeOn: 'On',
    diaryAiModeOff: 'Off',
    diaryAiModeAsk: 'Ask each time',
    diaryAiModeHint: 'With AI off, no AI feature reads this diary: its entries, their tags and files stay out of every AI action, chat, summary and analysis. Ask each time shows exactly what an AI action on one entry would send, and sends nothing until you confirm; the features that read the whole journal leave the diary out.',
    diaryAiOffSummary: 'AI off: no AI feature reads this diary',
    diaryAiAskSummary: 'AI asks first: each request shows what it sends',
    diaryAiOffNotice: 'AI is off for this diary: no AI feature reads its entries.',
    diaryAiAskNotice: 'This diary asks before each AI request, so the AI features that read many entries at once leave it out.',
    diaryAiOffLeftOut: 'Diaries with AI off or set to ask each time are left out.',
    aiConsentTitle: 'Send this to the AI?',
    aiConsentIntro: 'This diary asks before each AI request. This is exactly what will be sent, with Thoughty’s instructions for the task:',
    aiConsentProvider: 'It goes to OpenRouter, for the model {model}.',
    aiConsentProviderDefault: 'It goes to OpenRouter, for the model Thoughty uses by default.',
    aiConsentTags: 'Tags it already has',
    aiConsentQuestion: 'The question',
    aiConsentAskedBefore: 'Questions already offered',
    aiConsentConversation: 'The conversation, your new message last',
    aiConsentYou: 'You:',
    aiConsentAssistant: 'AI:',
    aiConsentRecordingIntro: 'This diary asks before each AI request. This recording will be sent to be turned into text:',
    aiConsentRecordingLength: '{name} ({length})',
    aiConsentTranscriptionProvider: 'It goes to OpenRouter, for the speech-to-text model Thoughty uses.',
    aiConsentSend: 'Send',
  },
  fr: {
    diaryAiMode: 'IA',
    diaryAiModeOn: 'Activée',
    diaryAiModeOff: 'Désactivée',
    diaryAiModeAsk: 'Demander à chaque fois',
    diaryAiModeHint: "Avec l'IA désactivée, aucune fonction d'IA ne lit ce journal : ses entrées, leurs tags et leurs fichiers restent hors de toute action, discussion, résumé et analyse d'IA. Demander à chaque fois montre exactement ce qu'une action d'IA sur une entrée enverrait, et n'envoie rien avant votre confirmation ; les fonctions qui lisent tout le journal laissent ce journal de côté.",
    diaryAiOffSummary: "IA désactivée : aucune fonction d'IA ne lit ce journal",
    diaryAiAskSummary: "L'IA demande d'abord : chaque requête montre ce qu'elle envoie",
    diaryAiOffNotice: "L'IA est désactivée pour ce journal : aucune fonction d'IA ne lit ses entrées.",
    diaryAiAskNotice: "Ce journal demande avant chaque requête d'IA : les fonctions d'IA qui lisent plusieurs entrées à la fois le laissent donc de côté.",
    diaryAiOffLeftOut: "Les journaux dont l'IA est désactivée ou demande à chaque fois sont laissés de côté.",
    aiConsentTitle: "Envoyer ceci à l'IA ?",
    aiConsentIntro: "Ce journal demande avant chaque requête d'IA. Voici exactement ce qui sera envoyé, avec les instructions de Thoughty pour la tâche :",
    aiConsentProvider: 'Il part chez OpenRouter, pour le modèle {model}.',
    aiConsentProviderDefault: 'Il part chez OpenRouter, pour le modèle que Thoughty utilise par défaut.',
    aiConsentTags: "Tags qu'elle a déjà",
    aiConsentQuestion: 'La question',
    aiConsentAskedBefore: 'Questions déjà proposées',
    aiConsentConversation: 'La conversation, votre nouveau message en dernier',
    aiConsentYou: 'Vous :',
    aiConsentAssistant: 'IA :',
    aiConsentRecordingIntro: "Ce journal demande avant chaque requête d'IA. Cet enregistrement sera envoyé pour être transcrit :",
    aiConsentRecordingLength: '{name} ({length})',
    aiConsentTranscriptionProvider: 'Il part chez OpenRouter, pour le modèle de transcription que Thoughty utilise.',
    aiConsentSend: 'Envoyer',
  },
};
