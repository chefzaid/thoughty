import type { Language } from './translations';

/** Text of the downloadable AI chat transcript, the writing tag picker and the language code of translated media tracks. */
export type AiChatTranslationKey =
  | 'aiChatTranscriptTitle'
  | 'aiChatTranscriptEntryId'
  | 'aiChatTranscriptDate'
  | 'aiChatTranscriptTags'
  | 'aiChatTranscriptNoTags'
  | 'aiChatTranscriptEntry'
  | 'aiChatTranscriptConversation'
  | 'aiChatTranscriptUser'
  | 'aiChatTranscriptAssistant'
  | 'tagPickerPlaceholder'
  | 'languageCode';

export const aiChatTranslations: Record<Language, Record<AiChatTranslationKey, string>> = {
  en: {
    aiChatTranscriptTitle: 'Thoughty AI Chat Transcript',
    aiChatTranscriptEntryId: 'Entry ID: {id}',
    aiChatTranscriptDate: 'Date: {date}',
    aiChatTranscriptTags: 'Tags: {tags}',
    aiChatTranscriptNoTags: 'Tags: None',
    aiChatTranscriptEntry: 'Entry:',
    aiChatTranscriptConversation: 'Conversation:',
    aiChatTranscriptUser: 'User:',
    aiChatTranscriptAssistant: 'Assistant:',
    tagPickerPlaceholder: 'tags...',
    languageCode: 'en',
  },
  fr: {
    aiChatTranscriptTitle: 'Transcription du chat IA de Thoughty',
    aiChatTranscriptEntryId: 'ID de l’entrée : {id}',
    aiChatTranscriptDate: 'Date : {date}',
    aiChatTranscriptTags: 'Tags : {tags}',
    aiChatTranscriptNoTags: 'Tags : aucun',
    aiChatTranscriptEntry: 'Entrée :',
    aiChatTranscriptConversation: 'Conversation :',
    aiChatTranscriptUser: 'Utilisateur :',
    aiChatTranscriptAssistant: 'Assistant :',
    tagPickerPlaceholder: 'tags...',
    languageCode: 'fr',
  },
};
