import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from './hookTestUtils';
import { useEntryTagSuggestions } from './useEntryTagSuggestions';

describe('useEntryTagSuggestions', () => {
  it('requests thematic tags and merges them with user tags', async () => {
    const suggestTags = vi.fn().mockResolvedValue(['belonging', 'self-awareness']);
    const setTags = vi.fn();
    const setFormError = vi.fn();
    const { result } = renderHook(() => useEntryTagSuggestions(
      { suggestTags },
      'I felt more at home after an honest conversation.',
      ['personal'],
      setTags,
      3,
      setFormError,
    ));

    await act(async () => {
      await result.current.handleSuggestTags('thematic');
    });

    expect(suggestTags).toHaveBeenCalledWith(
      'I felt more at home after an honest conversation.',
      ['personal'],
      3,
      'thematic',
    );
    const mergeTags = setTags.mock.calls[0]?.[0] as (current: string[]) => string[];
    expect(mergeTags(['personal'])).toEqual(['personal', 'belonging', 'self-awareness']);
    expect(result.current.suggestingTagStyle).toBeNull();
  });
});
