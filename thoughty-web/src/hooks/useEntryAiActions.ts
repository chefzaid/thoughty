import { useCallback } from 'react';
import type { createAiService, RephraseMode, SummaryGuidance } from '../services/api/aiService';
import type { Diary, Entry } from '../types';
import { diaryAiMode, isDiaryAiModeRefusal } from '../utils/diaryAi';
import { confirmAiRequest, consentDetails, type AiConsentMessage, type RequestAiConsent } from '../components/DiaryAi/aiConsent';

interface EntryAiActionsOptions {
  readonly aiService: Pick<ReturnType<typeof createAiService>, 'chat' | 'fixWriting' | 'summarizeEntry'>;
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
 * writer what it would send first, and sends nothing unless they confirm (in a chat, each message).
 */
export function useEntryAiActions({ aiService, diaries, requestConsent, editWith, notify, reloadDiaries, t }: EntryAiActionsOptions) {
  const handleRephrase = useCallback(async (entry: Entry, mode: RephraseMode) => {
    const consent = await confirmAiRequest(diaryAiMode(diaries, entry.diary_id), requestConsent, { text: entry.content, task: 'writing' });
    if (!consent.send) return;

    const { data: rewritten, refusal } = await aiService.fixWriting(entry.content, mode, entry.diary_id, consent.aiConsent);
    if (rewritten === null) {
      notify(t(refusal ?? 'rephraseEntryFailed'));
      if (isDiaryAiModeRefusal(refusal)) reloadDiaries();
      return;
    }
    editWith(entry, rewritten);
  }, [aiService, diaries, editWith, notify, reloadDiaries, requestConsent, t]);

  /** The summary, null when it failed, or undefined when the writer did not send the request. */
  const handleSummarize = useCallback(async (entry: Entry, guidance: SummaryGuidance) => {
    const consent = await confirmAiRequest(diaryAiMode(diaries, entry.diary_id), requestConsent, {
      text: entry.content,
      details: consentDetails([
        guidance.includeDetails ? { label: 'summaryIncludeDetails', value: guidance.includeDetails } : null,
        guidance.excludeDetails ? { label: 'summaryExcludeDetails', value: guidance.excludeDetails } : null,
      ]),
      task: 'summary',
    });
    if (!consent.send) return undefined;
    return aiService.summarizeEntry(entry.id, guidance, consent.aiConsent);
  }, [aiService, diaries, requestConsent]);

  /** The reply, null when it failed, or undefined when the writer did not send the message. */
  const handleChat = useCallback(async (entry: Entry, messages: AiConsentMessage[]) => {
    const consent = await confirmAiRequest(diaryAiMode(diaries, entry.diary_id), requestConsent, {
      text: entry.content,
      conversation: messages,
      task: 'chat',
    });
    if (!consent.send) return undefined;
    return aiService.chat(entry.id, entry.content, messages, consent.aiConsent);
  }, [aiService, diaries, requestConsent]);

  return { handleRephrase, handleSummarize, handleChat };
}
