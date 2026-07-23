import { describe, expect, it, vi } from 'vitest';
import { createFeatureRequestsService } from './featureRequestsService';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('featureRequestsService', () => {
  it('uses the generated feature-request API contracts', async () => {
    const authFetch = vi.fn()
      .mockResolvedValueOnce(response({ requests: [{ id: 1 }] }))
      .mockResolvedValueOnce(response({ requestIds: [1] }))
      .mockResolvedValueOnce(response({ id: 2 }, 201))
      .mockResolvedValueOnce(response({ requestId: 1, votes: 3, voted: true }, 201));
    const service = createFeatureRequestsService(authFetch);

    await expect(service.list()).resolves.toEqual([{ id: 1 }]);
    await expect(service.getVotedRequestIds()).resolves.toEqual([1]);
    await expect(service.create({ title: 'Title', details: 'Long details' }))
      .resolves.toEqual({ id: 2 });
    await expect(service.vote(1)).resolves.toEqual({ requestId: 1, votes: 3, voted: true });

    expect(authFetch).toHaveBeenNthCalledWith(3, '/api/feature-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Title', details: 'Long details' }),
    });
    expect(authFetch).toHaveBeenNthCalledWith(4, '/api/feature-requests/1/vote', {
      method: 'POST',
    });
  });

  it('surfaces API errors and malformed success responses', async () => {
    const authFetch = vi.fn()
      .mockResolvedValueOnce(response({ message: 'Unavailable' }, 503))
      .mockResolvedValueOnce(response(null));
    const service = createFeatureRequestsService(authFetch);

    await expect(service.list()).rejects.toThrow('Unavailable');
    await expect(service.list()).rejects.toThrow('Failed to load feature requests');
  });
});
