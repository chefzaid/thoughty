import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type Person = components['schemas']['PersonResponseDto'];
export type PersonList = components['schemas']['PersonListResponseDto'];
type PersonDeleteResult = components['schemas']['SuccessResponseDto'];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** The people the writer mentions with `@handle`. Errors are translation keys, or the API's coded reason. */
export const createPeopleService = (authFetch: AuthFetchFunction) => ({
  list(): Promise<ServiceResult<PersonList>> {
    return requestJson(authFetch('/api/people'), 'peopleLoadFailed');
  },

  /** Changes the name shown; the person's handles and the entries' text stay as they are. */
  rename(id: number, name: string): Promise<ServiceResult<Person>> {
    const body: components['schemas']['UpdatePersonDto'] = { name };
    return requestJson(
      authFetch(`/api/people/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) }),
      'personSaveFailed',
    );
  },

  /** Moves the duplicate's handles and entries to the person, then deletes the duplicate. */
  merge(id: number, duplicateId: number): Promise<ServiceResult<Person>> {
    const body: components['schemas']['MergePersonDto'] = { duplicateId };
    return requestJson(
      authFetch(`/api/people/${id}/merge`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }),
      'personMergeFailed',
    );
  },

  remove(id: number): Promise<ServiceResult<PersonDeleteResult>> {
    return requestJson(authFetch(`/api/people/${id}`, { method: 'DELETE' }), 'personDeleteFailed');
  },
});

export type PeopleService = ReturnType<typeof createPeopleService>;
