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

  it('returns an empty array when tags payload is not an array', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tags: 'not-an-array' }),
    });

    const result = await service.suggestTags('Some draft text');

    expect(result).toEqual([]);
  });

  it('fixWriting returns fixed content when response is valid', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: 'Improved text' }),
    });

    const result = await service.fixWriting('raw text');

    expect(result).toBe('Improved text');
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/ai/fix-writing', {
      method: 'POST',
      body: JSON.stringify({ content: 'raw text' }),
    });
  });

  it('fixWriting returns null for malformed payload', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: 123 }),
    });

    const result = await service.fixWriting('raw text');

    expect(result).toBeNull();
  });

  it('chat returns assistant reply on success', async () => {
    const messages = [{ role: 'user' as const, content: 'Hello' }];
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: 'Hi there' }),
    });

    const result = await service.chat(7, 'Entry content', messages);

    expect(result).toBe('Hi there');
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ entryId: 7, entryContent: 'Entry content', messages }),
    });
  });

  it('chat returns null for malformed reply payload', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: 10 }),
    });

    const result = await service.chat(7, 'Entry content', []);

    expect(result).toBeNull();
  });

  it('getChatHistory returns stored messages on success', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        messages: [
          { role: 'user', content: 'Saved prompt' },
          { role: 'assistant', content: 'Saved reply' },
        ],
      }),
    });

    const result = await service.getChatHistory(12);

    expect(result).toEqual([
      { role: 'user', content: 'Saved prompt' },
      { role: 'assistant', content: 'Saved reply' },
    ]);
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/ai/history/12');
  });

  it('getChatHistory returns an empty array for malformed payloads', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ messages: [{ role: 'system', content: 'Nope' }] }),
    });

    await expect(service.getChatHistory(12)).resolves.toEqual([]);
  });

  it('fetchModels returns models only when response is ok and array-shaped', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: 'm1', name: 'Model 1' }]),
    });
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'm1', name: 'Model 1' }),
    });
    mockAuthFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve([]) });

    await expect(service.fetchModels()).resolves.toEqual([{ id: 'm1', name: 'Model 1' }]);
    await expect(service.fetchModels()).resolves.toEqual([]);
    await expect(service.fetchModels()).resolves.toEqual([]);
  });

  it('returns fallback values when fixWriting, chat, or fetchModels throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockAuthFetch.mockRejectedValueOnce(new Error('fix writing network'));
    mockAuthFetch.mockRejectedValueOnce(new Error('chat network'));
    mockAuthFetch.mockRejectedValueOnce(new Error('history network'));
    mockAuthFetch.mockRejectedValueOnce(new Error('models network'));

    await expect(service.fixWriting('raw')).resolves.toBeNull();
    await expect(service.chat(1, 'entry', [])).resolves.toBeNull();
    await expect(service.getChatHistory(1)).resolves.toEqual([]);
    await expect(service.fetchModels()).resolves.toEqual([]);

    expect(consoleSpy).toHaveBeenCalledWith('Error fixing writing:', expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith('Error in AI chat:', expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith('Error loading AI chat history:', expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching models:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});