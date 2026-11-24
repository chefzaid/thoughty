import type { createAiService } from '../api/aiService';
import type { AiAnswer, RephraseMode, SummaryGuidance } from '../api/aiTypes';
import type { DiaryAiMode } from '../../utils/diaryAi';
import { completeWithLocalModel, type LocalModelMessage, type LocalModelResult } from './localModelClient';
import { parseTagAnswer, rephraseMessages, summaryMessages, tagMessages, unwrapBlock } from './localModelPrompts';
import type { LocalModelSettings } from './localModelSettings';

/** The AI actions on a text, Rephrase and Auto Tag, as the composer and an entry call them. */
export type TextAiService = Pick<ReturnType<typeof createAiService>, 'fixWriting' | 'suggestTags'>;

const answer = <T>(data: T): AiAnswer<T> => ({ data, refusal: null });

/**
 * The AI actions of a diary on the writer's own model, sent from this browser to the server `getSettings` names
 * (read at each request, so a change in the settings applies at once). Nothing goes through Thoughty's server.
 */
export function createLocalAiService(getSettings: () => LocalModelSettings | null) {
  const complete = async (messages: LocalModelMessage[], temperature: number): Promise<LocalModelResult<string>> => {
    const settings = getSettings();
    return settings ? completeWithLocalModel(settings, messages, temperature) : { data: null, problem: 'localModelNotConfigured' };
  };

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

  return { fixWriting, suggestTags, summarize };
}

export type LocalAiService = ReturnType<typeof createLocalAiService>;

/**
 * Where Rephrase and Auto Tag go for a diary in `mode`: the writer's own model for a diary set to it, Thoughty's
 * server (which checks the diary's mode again) for any other.
 */
export function textAiForDiary(mode: DiaryAiMode, aiService: TextAiService, localAi: LocalAiService): TextAiService {
  if (mode !== 'local') return aiService;
  return {
    fixWriting: (content, rephraseMode) => localAi.fixWriting(content, rephraseMode),
    suggestTags: (content, existingTags, maxTags) => localAi.suggestTags(content, existingTags, maxTags),
  };
}
