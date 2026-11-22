import { requestJson, type AuthFetchFunction, type ServiceResult } from './base';
import type { components } from '../../generated/openapi';

export type Person = components['schemas']['PersonResponseDto'];
export type PersonList = components['schemas']['PersonListResponseDto'];
export type MentionsOverTime = components['schemas']['MentionsOverTimeResponseDto'];
export type MentionPeriod = components['schemas']['MentionPeriodDto'];
type PersonDeleteResult = components['schemas']['SuccessResponseDto'];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** The people the writer mentions with `@handle`. Errors are translation keys, or the API's coded reason. */
export const createPeopleService = (authFetch: AuthFetchFunction) => ({
  list(): Promise<ServiceResult<PersonList>> {
    return requestJson(authFetch('/api/people'), 'peopleLoadFailed');
  },

  /**
   * Changes the name shown and sets their dates, their reach-out reminder and their last contact
   * (null removes each, leaving it out keeps it); the person's handles and the entries' text stay as they are.
   */
  update(id: number, body: components['schemas']['UpdatePersonDto']): Promise<ServiceResult<Person>> {
    return requestJson(
      authFetch(`/api/people/${id}`, { method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify(body) }),
      'personSaveFailed',
    );
  },

  /** Records the writer's day `today` as the last contact with the person, which ends a due reach-out reminder. */
  markContacted(id: number, today: string): Promise<ServiceResult<Person>> {
    const body: components['schemas']['MarkPersonContactedDto'] = { today };
    return requestJson(
      authFetch(`/api/people/${id}/contacted`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) }),
      'reachOutContactFailed',
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

  /** How many entries up to the writer's day `today` mention the person, by month over the last 12 months and by year. */
  mentionsOverTime(id: number, today: string): Promise<ServiceResult<MentionsOverTime>> {
    return requestJson(authFetch(`/api/people/${id}/mentions-over-time?${new URLSearchParams({ today }).toString()}`), 'personMentionsFailed');
  },

  /** The same for anyone in one of the writer's groups, each entry counted once. */
  groupMentionsOverTime(group: string, today: string): Promise<ServiceResult<MentionsOverTime>> {
    return requestJson(authFetch(`/api/people/mentions-over-time?${new URLSearchParams({ group, today }).toString()}`), 'personMentionsFailed');
  },

  remove(id: number): Promise<ServiceResult<PersonDeleteResult>> {
    return requestJson(authFetch(`/api/people/${id}`, { method: 'DELETE' }), 'personDeleteFailed');
  },
});

export type PeopleService = ReturnType<typeof createPeopleService>;
