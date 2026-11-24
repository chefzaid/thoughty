import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readDiaryEntryTags, useGetInspiration } from './useGetInspiration';

const diaries = [{ id: 1, aiMode: 'on' as const, isDefault: true }, { id: 2, aiMode: 'local' as const, isDefault: false }];
const batch = (tags: string[][], nextCursor: string | null) => ({
  entries: tags.map((entryTags, index) => ({ id: index, tags: entryTags })),
  total: 300,
  offset: 0,
  nextCursor,
  prevCursor: null,
  allTags: [],
});

function setup(currentDiaryId: number | null, fetchEntries = vi.fn().mockResolvedValue(batch([['rest'], ['sea']], null))) {
  const aiService = { getInspiration: vi.fn().mockResolvedValue('From the server') };
  const localAiService = { inspire: vi.fn().mockResolvedValue({ data: 'From my model', refusal: null }) };
  const entriesService = { fetchEntries };
  const { result } = renderHook(() => useGetInspiration({ aiService, localAiService, entriesService, diaries, currentDiaryId }));
  return { aiService, localAiService, entriesService, inspire: result.current };
}

describe('useGetInspiration', () => {
  it('asks Thoughty’s server for the diary shown, or all of them', async () => {
    const all = setup(null);
    await expect(all.inspire()).resolves.toBe('From the server');
    expect(all.aiService.getInspiration).toHaveBeenCalledWith(undefined);

    const work = setup(1);
    await expect(work.inspire()).resolves.toBe('From the server');
    expect(work.aiService.getInspiration).toHaveBeenCalledWith(1);
    expect(work.localAiService.inspire).not.toHaveBeenCalled();
  });

  it('asks the writer’s own model from the tags of a diary set to it, and says why it gave no question', async () => {
    const { aiService, localAiService, entriesService, inspire } = setup(2);

    await expect(inspire()).resolves.toBe('From my model');
    expect(entriesService.fetchEntries).toHaveBeenCalledWith(expect.objectContaining({ diaryId: 2, search: '', archiveStatus: 'all' }), 100, {});
    expect(localAiService.inspire).toHaveBeenCalledWith([['rest'], ['sea']]);
    expect(aiService.getInspiration).not.toHaveBeenCalled();

    localAiService.inspire.mockResolvedValueOnce({ data: null, refusal: 'apiError_AI_TAGGED_ENTRIES_REQUIRED' }).mockResolvedValueOnce({ data: null, refusal: null });
    await expect(inspire()).resolves.toEqual({ problem: 'apiError_AI_TAGGED_ENTRIES_REQUIRED' });
    await expect(inspire()).resolves.toEqual({ problem: 'inspirationError' });
  });

  it('gives no question when the diary’s entries cannot be read', async () => {
    const { localAiService, inspire } = setup(2, vi.fn().mockResolvedValue(null));
    await expect(inspire()).resolves.toBeNull();
    expect(localAiService.inspire).not.toHaveBeenCalled();
  });
});

describe('readDiaryEntryTags', () => {
  it('reads the newest entries’ tags in batches, up to as many as Get Inspired reads', async () => {
    const hundred = Array.from({ length: 100 }, () => ['a']);
    const fetchEntries = vi.fn()
      .mockResolvedValueOnce(batch(hundred, 'c1'))
      .mockResolvedValueOnce(batch(hundred, 'c2'));

    await expect(readDiaryEntryTags({ fetchEntries }, 2)).resolves.toHaveLength(200);
    expect(fetchEntries).toHaveBeenCalledTimes(2);
    expect(fetchEntries).toHaveBeenLastCalledWith(expect.objectContaining({ diaryId: 2 }), 100, { after: 'c1' });
  });

  it('reads no further than the diary’s last entry, and nothing from a failed or missing list', async () => {
    await expect(readDiaryEntryTags({ fetchEntries: vi.fn().mockResolvedValue(batch([['a'], []], null)) }, 2)).resolves.toEqual([['a'], []]);
    await expect(readDiaryEntryTags({ fetchEntries: vi.fn().mockResolvedValue('notFound') }, 2)).resolves.toBeNull();
    const untagged = { ...batch([], null), entries: [{ id: 1 }] };
    await expect(readDiaryEntryTags({ fetchEntries: vi.fn().mockResolvedValue(untagged) }, 2)).resolves.toEqual([[]]);
  });
});
