import { BadGatewayException } from '@nestjs/common';
import { parseDuplicateGroups, requestDuplicateGroups } from './duplicate-analysis';

describe('duplicate analysis', () => {
  it('keeps unique, allowed, high-confidence groups ordered by confidence', () => {
    const result = parseDuplicateGroups(
      JSON.stringify({
        groups: [
          { entryIds: [1, 2], confidence: 82, reason: 'Same decision about changing jobs.' },
          { entryIds: [2, 1], confidence: 95, reason: 'Repeated group.' },
          { entryIds: [1, 999], confidence: 98, reason: 'Contains another user entry.' },
          { entryIds: [2, 3], confidence: 69, reason: 'Too uncertain.' },
          { entryIds: [1, 3], confidence: 91, reason: 'Same plan and outcome.' },
        ],
      }),
      new Set([1, 2, 3]),
    );

    expect(result).toEqual([
      { entryIds: [1, 3], confidence: 91, reason: 'Same plan and outcome.' },
      { entryIds: [1, 2], confidence: 82, reason: 'Same decision about changing jobs.' },
    ]);
  });

  it.each(['not json', '{}', '{"groups":"invalid"}'])(
    'returns no groups for malformed content: %s',
    (content) => {
      expect(parseDuplicateGroups(content, new Set([1, 2]))).toEqual([]);
    },
  );

  it('sends bounded entry content and parses the OpenRouter response', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: '{"groups":[{"entryIds":[1,2],"confidence":88,"reason":"Same conclusion."}]}',
          },
        }],
      }),
    } as never);

    await expect(requestDuplicateGroups({
      apiKey: 'secret',
      model: 'test/model',
      entries: [
        { id: 1, date: '2026-01-01', tags: ['work'], content: 'a'.repeat(900) },
        { id: 2, date: '2026-01-02', tags: ['work'], content: 'Second entry' },
      ],
    })).resolves.toEqual([
      { entryIds: [1, 2], confidence: 88, reason: 'Same conclusion.' },
    ]);

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(requestBody.model).toBe('test/model');
    expect(JSON.parse(requestBody.messages[1].content).entries[0].content).toHaveLength(800);
    fetchMock.mockRestore();
  });

  it('rejects an upstream failure', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as never);

    await expect(requestDuplicateGroups({
      apiKey: 'secret',
      model: 'test/model',
      entries: [
        { id: 1, date: '2026-01-01', tags: [], content: 'One' },
        { id: 2, date: '2026-01-02', tags: [], content: 'Two' },
      ],
    })).rejects.toThrow(BadGatewayException);
    fetchMock.mockRestore();
  });
});
