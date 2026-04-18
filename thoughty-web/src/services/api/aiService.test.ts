import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAiService } from './aiService';

describe('aiService', () => {
  const mockAuthFetch = vi.fn();
  const service = createAiService(mockAuthFetch);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tags on successful suggestion response', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tags: ['focus', 'writing'] }),
    });

    const result = await service.suggestTags('Some draft text', ['journal'], 3);

    expect(result).toEqual(['focus', 'writing']);
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/ai/suggest-tags', {
      method: 'POST',
      body: JSON.stringify({ content: 'Some draft text', existingTags: ['journal'], maxTags: 3 }),
    });
  });

  it('returns null when the response is not ok', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Bad request' }),
    });

    const result = await service.suggestTags('Some draft text');

    expect(result).toBeNull();
  });

  it('returns null when the request throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthFetch.mockRejectedValue(new Error('Network error'));

    const result = await service.suggestTags('Some draft text');

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('Error suggesting tags:', expect.any(Error));
    consoleSpy.mockRestore();
  });
});