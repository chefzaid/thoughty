import { describe, expect, it, vi } from 'vitest';

import { createLifeErasService } from './lifeErasService';

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('lifeErasService', () => {
  it('lists, adds, changes and deletes life eras', async () => {
    const authFetch = vi.fn().mockResolvedValue(ok({ lifeEras: [], limit: 100 }));
    const service = createLifeErasService(authFetch);
    const draft = { name: 'University', startDate: '2010-09-01', endDate: null };

    await expect(service.list()).resolves.toEqual({ data: { lifeEras: [], limit: 100 }, error: null });
    await service.create(draft);
    await service.update(3, { endDate: '2014-06-30' });
    await service.remove(3);

    expect(authFetch.mock.calls.map(([url, options]) => [url, options?.method, options?.body])).toEqual([
      ['/api/life-eras', undefined, undefined],
      ['/api/life-eras', 'POST', JSON.stringify(draft)],
      ['/api/life-eras/3', 'PATCH', '{"endDate":"2014-06-30"}'],
      ['/api/life-eras/3', 'DELETE', undefined],
    ]);
  });

  it('gives the API error code to translate, or a translation key when the request fails', async () => {
    const conflict = new Response(
      JSON.stringify({ statusCode: 409, message: 'A life era with this name already exists', code: 'LIFE_ERA_NAME_TAKEN' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
    const service = createLifeErasService(vi.fn().mockResolvedValueOnce(conflict).mockRejectedValue(new Error('offline')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(service.create({ name: 'Uni', startDate: '2010-09-01' })).resolves.toEqual({ data: null, error: 'apiError_LIFE_ERA_NAME_TAKEN' });
    await expect(service.update(3, { name: 'Lyon' })).resolves.toEqual({ data: null, error: 'lifeEraSaveFailed' });
    await expect(service.remove(3)).resolves.toEqual({ data: null, error: 'lifeEraDeleteFailed' });
    await expect(service.list()).resolves.toEqual({ data: null, error: 'lifeErasLoadFailed' });
  });
});
