import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from './hookTestUtils';
import { useEntryTagSuggestions } from './useEntryTagSuggestions';

describe('useEntryTagSuggestions', () => {
  it('requests tags and merges them with user tags', async () => {
    const suggestTags = vi.fn().mockResolvedValue({ data: ['belonging', 'self-awareness'], refusal: null });
    const setTags = vi.fn();
    const setFormError = vi.fn();
    const { result } = renderHook(() => useEntryTagSuggestions(
      { suggestTags },
      'I felt more at home after an honest conversation.',
      ['personal'],
      setTags,
      3,
      setFormError,
      { diaryId: 7, mode: 'on' },
    ));

    await act(async () => {
      await result.current.handleSuggestTags();
    });

    expect(suggestTags).toHaveBeenCalledWith(
      'I felt more at home after an honest conversation.',
      ['personal'],
      3,
      7,
      undefined,
    );
    const mergeTags = setTags.mock.calls[0]?.[0] as (current: string[]) => string[];
    expect(mergeTags(['personal'])).toEqual(['personal', 'belonging', 'self-awareness']);
    expect(result.current.suggestingTags).toBe(false);
  });

  it('shows what a diary that asks each time would send, and sends it with consent only once confirmed', async () => {
    const suggestTags = vi.fn().mockResolvedValue({ data: ['sea'], refusal: null });
    const requestConsent = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const setTags = vi.fn();
    const { result } = renderHook(() => useEntryTagSuggestions(
      { suggestTags },
      'A dream about the sea',
      ['dreams'],
      setTags,
      3,
      vi.fn(),
      { diaryId: 4, mode: 'ask', requestConsent },
    ));

    await act(async () => {
      await expect(result.current.handleSuggestTags()).resolves.toBe(false);
    });
    expect(requestConsent).toHaveBeenCalledWith({
      text: 'A dream about the sea',
      details: [{ label: 'aiConsentTags', value: 'dreams' }],
      task: 'tag',
    });
    expect(suggestTags).not.toHaveBeenCalled();

    await act(async () => {
      await expect(result.current.handleSuggestTags()).resolves.toBe(true);
    });
    expect(suggestTags).toHaveBeenCalledWith('A dream about the sea', ['dreams'], 3, 4, true);
  });

  it('loads the diaries again when the server refuses the diary’s AI mode', async () => {
    const suggestTags = vi.fn().mockResolvedValue({ data: null, refusal: 'apiError_DIARY_AI_CONSENT_REQUIRED' });
    const onModeRefused = vi.fn();
    const setFormError = vi.fn();
    const { result } = renderHook(() => useEntryTagSuggestions(
      { suggestTags }, 'Text', [], vi.fn(), 3, setFormError, { diaryId: 4, mode: 'on', onModeRefused },
    ));

    await act(async () => {
      await result.current.handleSuggestTags();
    });
    expect(setFormError).toHaveBeenLastCalledWith('apiError_DIARY_AI_CONSENT_REQUIRED');
    expect(onModeRefused).toHaveBeenCalledTimes(1);
  });
});
