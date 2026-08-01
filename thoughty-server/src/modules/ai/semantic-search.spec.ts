import { BadGatewayException } from '@nestjs/common';
import {
  cosineSimilarity,
  parseEmbeddingResponse,
  rankSemanticMatches,
  requestEmbeddings,
} from './semantic-search';

describe('semantic search helpers', () => {
  it('orders indexed embeddings and rejects malformed vectors', () => {
    expect(parseEmbeddingResponse({
      data: [
        { index: 1, embedding: [0, 1] },
        { index: 0, embedding: [1, 0] },
      ],
    }, 2)).toEqual([[1, 0], [0, 1]]);

    expect(() => parseEmbeddingResponse({
      data: [{ index: 0, embedding: [1, Number.NaN] }],
    }, 1)).toThrow(BadGatewayException);
    expect(() => parseEmbeddingResponse({
      data: [{ index: 0, embedding: [1] }, { index: 1, embedding: [1, 0] }],
    }, 2)).toThrow(BadGatewayException);
  });

  it('calculates cosine similarity and returns bounded relevance order', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([0, 0], [1, 0])).toBe(0);
    expect(rankSemanticMatches([1, 0], [
      { id: 3, vector: [0, 1] },
      { id: 2, vector: [1, 0] },
      { id: 1, vector: [1, 0] },
    ], 2)).toEqual([
      { entryId: 1, score: 1 },
      { entryId: 2, score: 1 },
    ]);
  });

  it('requests a batch from the OpenRouter embeddings endpoint', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ data: [{ index: 0, embedding: [1, 0] }] }),
    } as never);

    await expect(requestEmbeddings({
      apiKey: 'secret',
      model: 'embedding/model',
      input: ['meaningful query'],
    })).resolves.toEqual([[1, 0]]);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/embeddings',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body).toEqual({ model: 'embedding/model', input: ['meaningful query'] });
    fetchMock.mockRestore();
  });

  it('rejects an upstream embedding failure', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false } as never);

    await expect(requestEmbeddings({
      apiKey: 'secret',
      model: 'embedding/model',
      input: ['query'],
    })).rejects.toThrow(BadGatewayException);
    fetchMock.mockRestore();
  });
});
