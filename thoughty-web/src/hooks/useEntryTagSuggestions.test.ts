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
      7,
    ));

    await act(async () => {
      await result.current.handleSuggestTags();
    });

    expect(suggestTags).toHaveBeenCalledWith(
      'I felt more at home after an honest conversation.',
      ['personal'],
      3,
      7,
    );
    const mergeTags = setTags.mock.calls[0]?.[0] as (current: string[]) => string[];
    expect(mergeTags(['personal'])).toEqual(['personal', 'belonging', 'self-awareness']);
    expect(result.current.suggestingTags).toBe(false);
  });
});
