import { useCallback } from 'react';
import type { AiProblem, createAiService, RephraseMode, SummaryGuidance } from '../services/api/aiService';
import type { Diary, Entry } from '../types';
import { diaryAiMode, isDiaryAiModeRefusal } from '../utils/diaryAi';
import { confirmAiRequest, consentDetails, type AiConsentMessage, type RequestAiConsent } from '../components/DiaryAi/aiConsent';
import type { LocalAiService } from '../services/localModel/localAiService';

interface EntryAiActionsOptions {
  readonly aiService: Pick<ReturnType<typeof createAiService>, 'chat' | 'fixWriting' | 'getChatHistory' | 'summarizeEntry'>;
  /** The writer's own model, for an entry of a diary set to it. */
  readonly localAiService: Pick<LocalAiService, 'chat' | 'fixWriting' | 'loadChat' | 'summarize'>;
  readonly diaries: readonly Pick<Diary, 'id' | 'aiMode'>[];
  /** Opens the consent dialog for an entry of a diary that asks each time. */
  readonly requestConsent: RequestAiConsent;
  /** Opens the entry in the editor with the rewritten text. */
  readonly editWith: (entry: Entry, text: string) => void;
  readonly notify: (message: string) => void;
  /** Loads the diaries again after the server refused a request for its diary's AI mode. */
  readonly reloadDiaries: () => void;
  readonly t: (key: string) => string;
}

/**
 * The AI actions of one entry, Rephrase, Summarize and its chat: an entry of a diary that asks each time shows the
 * writer what it would send first, and sends nothing unless they confirm (in a chat, each message). In a diary on
 * the writer's own model, all three go to that model from this browser, and the chat is kept in this browser only.
 */
export function useEntryAiActions({ aiService, localAiService, diaries, requestConsent, editWith, notify, reloadDiaries, t }: EntryAiActionsOptions) {
  const handleRephrase = useCallback(async (entry: Entry, mode: RephraseMode) => {
    const aiMode = diaryAiMode(diaries, entry.diary_id);
    const consent = await confirmAiRequest(aiMode, requestConsent, { text: entry.content, task: 'writing' });
    if (!consent.send) return;

    const { data: rewritten, refusal } = aiMode === 'local'
      ? await localAiService.fixWriting(entry.content, mode)
      : await aiService.fixWriting(entry.content, mode, entry.diary_id, consent.aiConsent);
    if (rewritten === null) {
      notify(t(refusal ?? 'rephraseEntryFailed'));
      if (isDiaryAiModeRefusal(refusal)) reloadDiaries();
      return;
    }
    editWith(entry, rewritten);
  }, [aiService, diaries, editWith, localAiService, notify, reloadDiaries, requestConsent, t]);

  /**
   * The summary, null when it failed, or undefined when there is none to show: the writer did not send the
   * request, or their own model gave none (the notice that says why is shown).
   */
  const handleSummarize = useCallback(async (entry: Entry, guidance: SummaryGuidance) => {
    const aiMode = diaryAiMode(diaries, entry.diary_id);
    if (aiMode === 'local') {
      const { data: summary, refusal } = await localAiService.summarize(entry.content, guidance);
      if (summary === null) notify(t(refusal ?? 'summaryError'));
      return summary ?? undefined;
    }
    const consent = await confirmAiRequest(aiMode, requestConsent, {
      text: entry.content,
      details: consentDetails([
        guidance.includeDetails ? { label: 'summaryIncludeDetails', value: guidance.includeDetails } : null,
        guidance.excludeDetails ? { label: 'summaryExcludeDetails', value: guidance.excludeDetails } : null,
      ]),
      task: 'summary',
    });
    if (!consent.send) return undefined;
    return aiService.summarizeEntry(entry.id, guidance, consent.aiConsent);
  }, [aiService, diaries, localAiService, notify, requestConsent, t]);

  /**
   * The reply, null when it failed, the reason when the writer's own model gave none, or undefined when the writer
   * did not send the message.
   */
  const handleChat = useCallback(async (entry: Entry, messages: AiConsentMessage[]): Promise<string | AiProblem | null | undefined> => {
    const aiMode = diaryAiMode(diaries, entry.diary_id);
    if (aiMode === 'local') {
      const { data: reply, refusal } = await localAiService.chat(entry.id, entry.content, messages);
      return reply ?? { problem: refusal ?? 'aiChatError' };
    }
    const consent = await confirmAiRequest(aiMode, requestConsent, {
      text: entry.content,
      conversation: messages,
      task: 'chat',
    });
    if (!consent.send) return undefined;
    return aiService.chat(entry.id, entry.content, messages, consent.aiConsent);
  }, [aiService, diaries, localAiService, requestConsent]);

  /** The entry's earlier chat: from this browser in a diary on the writer's own model, else from the server. */
  const handleLoadChatHistory = useCallback(async (entryId: number, diaryId: number | null | undefined) => (
    diaryAiMode(diaries, diaryId) === 'local' ? localAiService.loadChat(entryId) : aiService.getChatHistory(entryId)
  ), [aiService, diaries, localAiService]);

  return { handleRephrase, handleSummarize, handleChat, handleLoadChatHistory };
}
