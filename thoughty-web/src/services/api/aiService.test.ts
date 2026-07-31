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

  it('includes the thematic style only when explicitly requested', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ tags: ['belonging'] }),
    });

    await service.suggestTags('A reflection about finding my place.', ['journal'], 4, 'thematic');

    expect(mockAuthFetch).toHaveBeenCalledWith('/api/ai/suggest-tags', {
      method: 'POST',
      body: JSON.stringify({
        content: 'A reflection about finding my place.',
        existingTags: ['journal'],
        maxTags: 4,
        style: 'thematic',
      }),
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

    const result = await service.fixWriting('raw text', 'polish');

    expect(result).toBe('Improved text');
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/ai/fix-writing', {
      method: 'POST',
      body: JSON.stringify({ content: 'raw text', mode: 'polish' }),
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

  it('summarizeEntry returns a summary and sends optional guidance', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ summary: 'A concise summary.' }),
    });

    const result = await service.summarizeEntry(12, {
      includeDetails: 'decisions',
      excludeDetails: 'names',
    });

    expect(result).toBe('A concise summary.');
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/ai/summarize', {
      method: 'POST',
      body: JSON.stringify({
        entryId: 12,
        includeDetails: 'decisions',
        excludeDetails: 'names',
      }),
    });
  });

  it('summarizeEntry returns null for malformed and failed responses', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ summary: 12 }),
    });
    mockAuthFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Unavailable' }),
    });

    await expect(service.summarizeEntry(12)).resolves.toBeNull();
    await expect(service.summarizeEntry(12)).resolves.toBeNull();
  });

  it('generateWritingPrompts returns normalized prompts for a diary', async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        prompts: [' First prompt? ', 12, 'Second prompt?', 'Third prompt?', 'Ignored prompt?'],
      }),
    });

    const result = await service.generateWritingPrompts(4);

    expect(result).toEqual(['First prompt?', 'Second prompt?', 'Third prompt?']);
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/ai/writing-prompts', {
      method: 'POST',
      body: JSON.stringify({ diaryId: 4 }),
    });
  });

  it('generateWritingPrompts returns null for malformed or failed responses', async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ prompts: 'not-an-array' }),
    });
    mockAuthFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Unavailable' }),
    });

    await expect(service.generateWritingPrompts()).resolves.toBeNull();
    await expect(service.generateWritingPrompts()).resolves.toBeNull();
  });

  it('findDuplicateEntries returns a valid diary-scoped scan', async () => {
    const scan = {
      analyzedEntries: 2,
      totalEntries: 2,
      truncated: false,
      groups: [{ confidence: 90, reason: 'Same conclusion', entries: [] }],
    };
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(scan),
    });

    await expect(service.findDuplicateEntries(4)).resolves.toEqual(scan);
    expect(mockAuthFetch).toHaveBeenCalledWith('/api/ai/duplicates', {
      method: 'POST',
      body: JSON.stringify({ diaryId: 4 }),
    });
  });

  it('findDuplicateEntries rejects malformed, failed, and thrown responses', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ analyzedEntries: 'two', totalEntries: 2, truncated: false, groups: [] }),
    });
    mockAuthFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve({}) });
    mockAuthFetch.mockRejectedValueOnce(new Error('duplicate scan network'));

    await expect(service.findDuplicateEntries()).resolves.toBeNull();
    await expect(service.findDuplicateEntries()).resolves.toBeNull();
    await expect(service.findDuplicateEntries()).resolves.toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith('Error finding duplicate entries:', expect.any(Error));
    consoleSpy.mockRestore();
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

  it('returns fallback values when AI requests throw', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockAuthFetch.mockRejectedValueOnce(new Error('fix writing network'));
    mockAuthFetch.mockRejectedValueOnce(new Error('summary network'));
    mockAuthFetch.mockRejectedValueOnce(new Error('prompt network'));
    mockAuthFetch.mockRejectedValueOnce(new Error('chat network'));
    mockAuthFetch.mockRejectedValueOnce(new Error('history network'));
    mockAuthFetch.mockRejectedValueOnce(new Error('models network'));

    await expect(service.fixWriting('raw')).resolves.toBeNull();
    await expect(service.summarizeEntry(1)).resolves.toBeNull();
    await expect(service.generateWritingPrompts()).resolves.toBeNull();
    await expect(service.chat(1, 'entry', [])).resolves.toBeNull();
    await expect(service.getChatHistory(1)).resolves.toEqual([]);
    await expect(service.fetchModels()).resolves.toEqual([]);

    expect(consoleSpy).toHaveBeenCalledWith('Error fixing writing:', expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith('Error summarizing entry:', expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith('Error generating writing prompts:', expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith('Error in AI chat:', expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith('Error loading AI chat history:', expect.any(Error));
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching models:', expect.any(Error));

    consoleSpy.mockRestore();
  });
});
