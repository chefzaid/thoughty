import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Entry } from '../types';
import { useEntryAiActions } from './useEntryAiActions';

const entry = (diaryId: number) => ({ id: 44, content: 'A dream about the sea', diary_id: diaryId } as Entry);
const diaries = [{ id: 1, aiMode: 'on' as const }, { id: 2, aiMode: 'ask' as const }];

function setup(requestConsent = vi.fn().mockResolvedValue(true)) {
  const aiService = {
    fixWriting: vi.fn().mockResolvedValue({ data: 'Rewritten', refusal: null }),
    summarizeEntry: vi.fn().mockResolvedValue('A summary'),
  };
  const options = {
    aiService,
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
});
