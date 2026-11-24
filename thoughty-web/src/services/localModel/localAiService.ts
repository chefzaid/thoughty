import type { createAiService } from '../api/aiService';
import type { AiAnswer, RephraseMode, SummaryGuidance } from '../api/aiTypes';
import type { DiaryAiMode } from '../../utils/diaryAi';
import { readLocalChat, writeLocalChat, type LocalChatMessage } from './localChatHistory';
import { completeWithLocalModel, type LocalModelMessage, type LocalModelResult } from './localModelClient';
import { chatMessages, parseTagAnswer, rephraseMessages, summaryMessages, tagMessages, unwrapBlock } from './localModelPrompts';
import type { LocalModelSettings } from './localModelSettings';
import { transcribeWithLocalModel } from './localModelTranscription';
import {
  followUpMessages,
  inspirationMessages,
  parseFollowUps,
  parseInspiration,
  summarizeThemes,
  type FollowUpRequest,
} from './localModelWritingPrompts';

/** The AI actions on a text, Rephrase and Auto Tag, as the composer and an entry call them. */
export type TextAiService = Pick<ReturnType<typeof createAiService>, 'fixWriting' | 'suggestTags'>;

const answer = <T>(data: T): AiAnswer<T> => ({ data, refusal: null });

/**
 * The AI actions of a diary on the writer's own model, sent from this browser to the server `getSettings` names
 * (read at each request, so a change in the settings applies at once). Nothing goes through Thoughty's server, and
 * the chats about its entries are kept in this browser only, for the writer `userId`.
 */
export function createLocalAiService(getSettings: () => LocalModelSettings | null, userId: number | null = null) {
  const complete = async (messages: LocalModelMessage[], temperature: number): Promise<LocalModelResult<string>> => {
    const settings = getSettings();
    return settings ? completeWithLocalModel(settings, messages, temperature) : { data: null, problem: 'localModelNotConfigured' };
  };

  /** Whether this browser has the writer's model server set up, so the actions that need no button can run. */
  const isConfigured = () => getSettings() !== null;

  const fixWriting = async (content: string, mode: RephraseMode = 'grammar'): Promise<AiAnswer<string>> => {
    const result = await complete(rephraseMessages(content, mode), 0.2);
    if (result.data === null) return { data: null, refusal: result.problem };
    return answer(unwrapBlock('text', result.data).trim() || content);
  };

  const suggestTags = async (content: string, existingTags: string[] = [], maxTags = 5): Promise<AiAnswer<string[]>> => {
    const limit = Math.min(Math.max(maxTags, 1), 10);
    const result = await complete(tagMessages(content, existingTags, limit), 0.2);
    if (result.data === null) return { data: null, refusal: result.problem };
    return answer(parseTagAnswer(result.data, existingTags, limit));
  };

  const summarize = async (content: string, guidance: SummaryGuidance = {}): Promise<AiAnswer<string>> => {
    const result = await complete(summaryMessages(content, guidance), 0.2);
    return result.data === null ? { data: null, refusal: result.problem } : answer(result.data);
  };

  /** The chat about an entry this browser keeps. */
  const loadChat = (entryId: number): LocalChatMessage[] => readLocalChat(userId, entryId);

  /** The reply to the conversation (the writer's newest message last), kept with it in this browser. */
  const chat = async (entryId: number, entryContent: string, messages: readonly LocalChatMessage[]): Promise<AiAnswer<string>> => {
    const result = await complete(chatMessages(entryContent, messages), 0.5);
    if (result.data === null) return { data: null, refusal: result.problem };
    writeLocalChat(userId, entryId, [...messages, { role: 'assistant', content: result.data }]);
    return answer(result.data);
  };

  /** A reflective question from the tags of a diary's entries, newest first; none without a tag to ground it. */
  const inspire = async (entryTags: readonly (readonly string[])[]): Promise<AiAnswer<string>> => {
    const { themes, recentThemes } = summarizeThemes(entryTags);
    if (themes.length === 0) return { data: null, refusal: 'apiError_AI_TAGGED_ENTRIES_REQUIRED' };
    const result = await complete(inspirationMessages(themes, recentThemes), 0.9);
    if (result.data === null) return { data: null, refusal: result.problem };
    const question = parseInspiration(result.data);
    return question ? answer(question) : { data: null, refusal: 'localModelUnreadable' };
  };

  /** Up to three questions that deepen a memoir answer, none of those already asked. */
  const memoirFollowUps = async (request: FollowUpRequest): Promise<AiAnswer<string[]>> => {
    const result = await complete(followUpMessages(request), 0.6);
    if (result.data === null) return { data: null, refusal: result.problem };
    const questions = parseFollowUps(result.data, request.asked);
    return questions ? answer(questions) : { data: null, refusal: 'localModelUnreadable' };
  };

  /** The text of a recording, from the writer's speech-to-text model; a recording with no words in it gives none. */
  const transcribe = async (audio: Blob, filename: string): Promise<AiAnswer<string>> => {
    const settings = getSettings();
    if (!settings) return { data: null, refusal: 'localModelNotConfigured' };
    const result = await transcribeWithLocalModel(settings, audio, filename);
    if (result.data === null) return { data: null, refusal: result.problem };
    return result.data ? answer(result.data) : { data: null, refusal: 'localModelNoSpeech' };
  };

  return { isConfigured, fixWriting, suggestTags, summarize, loadChat, chat, inspire, memoirFollowUps, transcribe };
}

export type LocalAiService = ReturnType<typeof createLocalAiService>;

/**
 * Where Rephrase and Auto Tag go for a diary in `mode`: the writer's own model for a diary set to it, Thoughty's
 * server (which checks the diary's mode again) for any other.
 */
export function textAiForDiary(mode: DiaryAiMode, aiService: TextAiService, localAi: Pick<LocalAiService, 'fixWriting' | 'suggestTags'>): TextAiService {
  if (mode !== 'local') return aiService;
  return {
    fixWriting: (content, rephraseMode) => localAi.fixWriting(content, rephraseMode),
    suggestTags: (content, existingTags, maxTags) => localAi.suggestTags(content, existingTags, maxTags),
  };
}
