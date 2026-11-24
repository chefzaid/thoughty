import { describe, expect, it, vi } from 'vitest';
import { autoTagWithLocalModel } from './localAutoTag';

function setup(suggested: string[] | null, added: { success: boolean; affectedCount: number } | null = { success: true, affectedCount: 1 }) {
  const localAi = { suggestTags: vi.fn().mockResolvedValue(suggested === null ? { data: null, refusal: 'localModelUnreachable' } : { data: suggested, refusal: null }) };
  const entriesService = { bulkOperation: vi.fn().mockResolvedValue(added) };
  const tag = (tags: string[], limit = 3, text = 'A walk by the sea') =>
    autoTagWithLocalModel({ localAi, entriesService, entryId: 9, text, tags, limit });
  return { localAi, entriesService, tag };
}

describe('auto-tagging a saved entry with the writer’s own model', () => {
  it('adds the tags the entry lacks up to the writer’s limit', async () => {
    const { localAi, entriesService, tag } = setup(['sea', 'walks', 'extra']);

    await expect(tag(['calm'])).resolves.toBe('tagged');
    expect(localAi.suggestTags).toHaveBeenCalledWith('A walk by the sea', ['calm'], 2);
    expect(entriesService.bulkOperation).toHaveBeenCalledWith([9], 'tags', { tags: ['sea', 'walks'] });
  });

  it('asks nothing when the entry has its tags already, or has no text', async () => {
    const { localAi, tag } = setup(['sea']);

    await expect(tag(['a', 'b', 'c'])).resolves.toBe('none');
    await expect(tag([], 3, '  ')).resolves.toBe('none');
    expect(localAi.suggestTags).not.toHaveBeenCalled();
  });

  it('adds nothing when the model suggests none, and fails when it gives no answer or the tags are not added', async () => {
    await expect(setup([]).tag([])).resolves.toBe('none');
    await expect(setup(null).tag([])).resolves.toBe('failed');
    await expect(setup(['sea'], null).tag([])).resolves.toBe('failed');
    await expect(setup(['sea'], { success: false, affectedCount: 0 }).tag([])).resolves.toBe('failed');
  });
});
