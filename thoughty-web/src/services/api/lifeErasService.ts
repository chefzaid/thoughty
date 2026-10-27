import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type LifeEra = components['schemas']['LifeEraResponseDto'];
export type LifeEraList = components['schemas']['LifeEraListResponseDto'];
export type LifeEraDraft = components['schemas']['CreateLifeEraDto'];
export type LifeEraChanges = components['schemas']['UpdateLifeEraDto'];
type LifeEraDeleteResult = components['schemas']['SuccessResponseDto'];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** The writer's life eras. Errors are translation keys, or the API's coded reason. */
export const createLifeErasService = (authFetch: AuthFetchFunction) => ({
  list(): Promise<ServiceResult<LifeEraList>> {
    return requestJson(authFetch('/api/life-eras'), 'lifeErasLoadFailed');
  },

  create(draft: LifeEraDraft): Promise<ServiceResult<LifeEra>> {
    return requestJson(
      authFetch('/api/life-eras', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(draft) }),
      'lifeEraSaveFailed',
    );
  },

  update(id: number, changes: LifeEraChanges): Promise<ServiceResult<LifeEra>> {
    return requestJson(
      authFetch(`/api/life-eras/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(changes) }),
      'lifeEraSaveFailed',
    );
  },

  remove(id: number): Promise<ServiceResult<LifeEraDeleteResult>> {
    return requestJson(authFetch(`/api/life-eras/${id}`, { method: 'DELETE' }), 'lifeEraDeleteFailed');
  },
});

export type LifeErasService = ReturnType<typeof createLifeErasService>;
