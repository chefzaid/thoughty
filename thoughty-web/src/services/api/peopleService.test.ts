import { describe, expect, it, vi } from 'vitest';

import { createPeopleService } from './peopleService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('peopleService', () => {
  it('lists, renames, merges and deletes people', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ people: [], limit: 1000 }));
    const service = createPeopleService(authFetch);

    await expect(service.list()).resolves.toEqual({ data: { people: [], limit: 1000 }, error: null });
    await service.rename(12, 'Marie Curie');
    await service.merge(12, 14);
    await service.remove(12);

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/people', undefined, undefined],
      ['/api/people/12', 'PATCH', '{"name":"Marie Curie"}'],
      ['/api/people/12/merge', 'POST', '{"duplicateId":14}'],
      ['/api/people/12', 'DELETE', undefined],
    ]);
  });

  it('gives the API error code to translate, or a translation key when the request fails', async () => {
    const missing = new Response(
      JSON.stringify({ statusCode: 404, message: 'Person not found', code: 'PERSON_NOT_FOUND' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
    const service = createPeopleService(vi.fn().mockResolvedValueOnce(missing).mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.rename(12, 'Marie')).resolves.toEqual({ data: null, error: 'apiError_PERSON_NOT_FOUND' });
    await expect(service.merge(12, 14)).resolves.toEqual({ data: null, error: 'personMergeFailed' });
    await expect(service.remove(12)).resolves.toEqual({ data: null, error: 'personDeleteFailed' });
    await expect(service.list()).resolves.toEqual({ data: null, error: 'peopleLoadFailed' });
  });
});
