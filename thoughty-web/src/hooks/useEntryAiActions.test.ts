import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Entry } from '../types';
import { useEntryAiActions } from './useEntryAiActions';

const entry = (diaryId: number) => ({ id: 44, content: 'A dream about the sea', diary_id: diaryId } as Entry);
const diaries = [{ id: 1, aiMode: 'on' as const }, { id: 2, aiMode: 'ask' as const }, { id: 3, aiMode: 'local' as const }];

function setup(requestConsent = vi.fn().mockResolvedValue(true)) {
  const aiService = {
    fixWriting: vi.fn().mockResolvedValue({ data: 'Rewritten', refusal: null }),
    summarizeEntry: vi.fn().mockResolvedValue('A summary'),
    chat: vi.fn().mockResolvedValue('A reply'),
    getChatHistory: vi.fn().mockResolvedValue([{ role: 'user', content: 'On the server' }]),
  };
  const localAiService = {
    fixWriting: vi.fn().mockResolvedValue({ data: 'Rewritten here', refusal: null }),
    suggestTags: vi.fn(),
    summarize: vi.fn().mockResolvedValue({ data: 'A summary from my model', refusal: null }),
    chat: vi.fn().mockResolvedValue({ data: 'A reply from my model', refusal: null }),
    loadChat: vi.fn().mockReturnValue([{ role: 'user', content: 'In this browser' }]),
  };
  const options = {
    aiService,
    localAiService,
    diaries,
    requestConsent,
    editWith: vi.fn(),
    notify: vi.fn(),
    reloadDiaries: vi.fn(),
    t: (key: string) => key,
  };
  const { result } = renderHook(() => useEntryAiActions(options));
  return { ...options, result };
}

describe('useEntryAiActions', () => {
  it('rephrases an entry of a diary with AI on without asking', async () => {
    const { result, aiService, requestConsent, editWith } = setup();

    await act(async () => result.current.handleRephrase(entry(1), 'polish'));

    expect(requestConsent).not.toHaveBeenCalled();
    expect(aiService.fixWriting).toHaveBeenCalledWith('A dream about the sea', 'polish', 1, undefined);
    expect(editWith).toHaveBeenCalledWith(entry(1), 'Rewritten');
  });

  it('shows what Rephrase would send from a diary that asks each time, and sends nothing when cancelled', async () => {
    const { result, aiService, requestConsent, editWith } = setup(vi.fn().mockResolvedValue(false));

    await act(async () => result.current.handleRephrase(entry(2), 'grammar'));

    expect(requestConsent).toHaveBeenCalledWith({ text: 'A dream about the sea', task: 'writing' });
    expect(aiService.fixWriting).not.toHaveBeenCalled();
    expect(editWith).not.toHaveBeenCalled();
  });

  it('sends a confirmed Rephrase with the consent, and reloads the diaries when the server refuses their mode', async () => {
    const { result, aiService, notify, reloadDiaries } = setup();
    aiService.fixWriting.mockResolvedValueOnce({ data: null, refusal: 'apiError_DIARY_AI_OFF' });

    await act(async () => result.current.handleRephrase(entry(2), 'grammar'));

    expect(aiService.fixWriting).toHaveBeenCalledWith('A dream about the sea', 'grammar', 2, true);
    expect(notify).toHaveBeenCalledWith('apiError_DIARY_AI_OFF');
    expect(reloadDiaries).toHaveBeenCalledTimes(1);
  });

  it('shows the summary guidance with the text, and summarizes only once confirmed', async () => {
    const requestConsent = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result, aiService } = setup(requestConsent);
    const guidance = { includeDetails: 'the boat', excludeDetails: '' };

    await expect(result.current.handleSummarize(entry(2), guidance)).resolves.toBeUndefined();
    expect(requestConsent).toHaveBeenCalledWith({
      text: 'A dream about the sea',
      details: [{ label: 'summaryIncludeDetails', value: 'the boat' }],
      task: 'summary',
    });
    expect(aiService.summarizeEntry).not.toHaveBeenCalled();

    await expect(result.current.handleSummarize(entry(2), guidance)).resolves.toBe('A summary');
    expect(aiService.summarizeEntry).toHaveBeenCalledWith(44, guidance, true);

    await expect(result.current.handleSummarize(entry(1), {})).resolves.toBe('A summary');
    expect(aiService.summarizeEntry).toHaveBeenLastCalledWith(44, {}, undefined);
    expect(requestConsent).toHaveBeenCalledTimes(2);
  });

  it('shows the entry and the whole conversation before each chat message of a diary that asks each time', async () => {
    const requestConsent = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { result, aiService } = setup(requestConsent);
    const messages = [
      { role: 'user' as const, content: 'Why the sea?' },
      { role: 'assistant' as const, content: 'It often means change.' },
      { role: 'user' as const, content: 'What change?' },
    ];

    await expect(result.current.handleChat(entry(2), messages)).resolves.toBeUndefined();
    expect(requestConsent).toHaveBeenCalledWith({ text: 'A dream about the sea', conversation: messages, task: 'chat' });
    expect(aiService.chat).not.toHaveBeenCalled();

    await expect(result.current.handleChat(entry(2), messages)).resolves.toBe('A reply');
    expect(aiService.chat).toHaveBeenCalledWith(44, 'A dream about the sea', messages, true);

    await expect(result.current.handleChat(entry(1), messages)).resolves.toBe('A reply');
    expect(aiService.chat).toHaveBeenLastCalledWith(44, 'A dream about the sea', messages, undefined);
    expect(requestConsent).toHaveBeenCalledTimes(2);
  });

  it('rephrases and summarizes an entry of a diary on the writer’s own model there, unasked and never through the API', async () => {
    const { result, aiService, localAiService, requestConsent, editWith } = setup();

    await act(async () => result.current.handleRephrase(entry(3), 'rewrite'));
    expect(localAiService.fixWriting).toHaveBeenCalledWith('A dream about the sea', 'rewrite');
    expect(editWith).toHaveBeenCalledWith(entry(3), 'Rewritten here');

    let summary: string | null | undefined;
    await act(async () => {
      summary = await result.current.handleSummarize(entry(3), { includeDetails: 'the sea' });
    });
    expect(summary).toBe('A summary from my model');
    expect(localAiService.summarize).toHaveBeenCalledWith('A dream about the sea', { includeDetails: 'the sea' });
    expect(aiService.fixWriting).not.toHaveBeenCalled();
    expect(aiService.summarizeEntry).not.toHaveBeenCalled();
    expect(requestConsent).not.toHaveBeenCalled();
  });

  it('says why the writer’s own model gave no rephrasing or summary', async () => {
    const { result, localAiService, notify, editWith, reloadDiaries } = setup();
    localAiService.fixWriting.mockResolvedValue({ data: null, refusal: 'localModelBlocked' });
    localAiService.summarize.mockResolvedValue({ data: null, refusal: 'localModelUnreachable' });

    await act(async () => result.current.handleRephrase(entry(3), 'grammar'));
    expect(notify).toHaveBeenCalledWith('localModelBlocked');
    expect(editWith).not.toHaveBeenCalled();
    expect(reloadDiaries).not.toHaveBeenCalled();

    let summary: string | null | undefined = 'unset';
    await act(async () => {
      summary = await result.current.handleSummarize(entry(3), {});
    });
    expect(summary).toBeUndefined();
    expect(notify).toHaveBeenCalledWith('localModelUnreachable');
  });

  it('chats about an entry of a diary on the writer’s own model there, unasked, with its history from this browser', async () => {
    const { result, aiService, localAiService, requestConsent } = setup();
    const messages = [{ role: 'user' as const, content: 'Why the sea?' }];

    await expect(result.current.handleLoadChatHistory(44, 3)).resolves.toEqual([{ role: 'user', content: 'In this browser' }]);
    expect(localAiService.loadChat).toHaveBeenCalledWith(44);
    await expect(result.current.handleLoadChatHistory(44, 1)).resolves.toEqual([{ role: 'user', content: 'On the server' }]);
    expect(aiService.getChatHistory).toHaveBeenCalledWith(44);

    let reply: unknown;
    await act(async () => {
      reply = await result.current.handleChat(entry(3), messages);
    });
    expect(reply).toBe('A reply from my model');
    expect(localAiService.chat).toHaveBeenCalledWith(44, 'A dream about the sea', messages);
    expect(aiService.chat).not.toHaveBeenCalled();
    expect(requestConsent).not.toHaveBeenCalled();

    localAiService.chat.mockResolvedValueOnce({ data: null, refusal: 'localModelTimeout' }).mockResolvedValueOnce({ data: null, refusal: null });
    await act(async () => {
      reply = await result.current.handleChat(entry(3), messages);
    });
    expect(reply).toEqual({ problem: 'localModelTimeout' });
    await act(async () => {
      reply = await result.current.handleChat(entry(3), messages);
    });
    expect(reply).toEqual({ problem: 'aiChatError' });
  });
});
