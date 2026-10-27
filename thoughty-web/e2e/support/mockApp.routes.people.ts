import type { components } from '../../src/generated/openapi';
import { findMentions } from '../../src/utils/mentions';
import type { MockAppState, MockEntry } from './mockApp.shared';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';

export const MOCK_PEOPLE_LIMIT = 1000;

type PersonResponse = components['schemas']['PersonResponseDto'];
/** A person as the mock keeps them; their counts are read from the entries' text on each request. */
export type MockPerson = Omit<PersonResponse, 'entryCount' | 'lastMentionedOn'>;

const mentionedHandles = (content: string) => new Set(findMentions(content).map((mention) => mention.handle));

/** Adds a person for each handle in the text that no one holds yet, as the API does when an entry is saved. */
export function addMockMentionedPeople(people: MockPerson[], content: string): void {
  for (const mention of findMentions(content)) {
    if (people.length >= MOCK_PEOPLE_LIMIT || people.some((person) => person.handles.includes(mention.handle))) continue;
    const now = new Date().toISOString();
    people.push({
      id: Math.max(0, ...people.map((person) => person.id)) + 1,
      name: content.slice(mention.start + 1, mention.end),
      handles: [mention.handle],
      createdAt: now,
      updatedAt: now,
    });
  }
}

/** Whether the entry mentions the person by one of their handles. */
export function mockMentions(entry: Pick<MockEntry, 'content'>, person: Pick<MockPerson, 'handles'>): boolean {
  const handles = mentionedHandles(entry.content);
  return person.handles.some((handle) => handles.has(handle));
}

function toResponse(state: MockAppState, person: MockPerson): PersonResponse {
  const entries = state.entries.filter((entry) => mockMentions(entry, person));
  const lastMentionedOn = entries.map((entry) => entry.date).sort().at(-1) ?? null;
  return { ...person, entryCount: entries.length, lastMentionedOn };
}

const byName = (left: MockPerson, right: MockPerson) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()) || left.id - right.id;

/**
 * `/api/people` as the API answers it: people by name with their counts outside the recycle bin, renaming the
 * name shown, merging a duplicate (its handles move, saved searches follow) and deleting (saved searches widen).
 */
export async function handlePeopleRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/people' && request.method() === 'GET') {
    await fulfillJson(route, { people: [...state.people].sort(byName).map((person) => toResponse(state, person)), limit: MOCK_PEOPLE_LIMIT });
    return true;
  }

  const match = /^\/api\/people\/(\d+)(\/merge)?$/.exec(pathname);
  if (!match) return false;
  const person = state.people.find((candidate) => candidate.id === Number(match[1]));
  if (!person) {
    await fulfillApiError(route, 404, 'PERSON_NOT_FOUND', 'Person not found');
    return true;
  }

  if (match[2] && request.method() === 'POST') {
    const { duplicateId } = request.postDataJSON() as components['schemas']['MergePersonDto'];
    const duplicate = state.people.find((candidate) => candidate.id === duplicateId);
    if (duplicateId === person.id) {
      await fulfillApiError(route, 400, 'PERSON_MERGE_SAME', 'A person cannot be merged into themselves');
      return true;
    }
    if (!duplicate) {
      await fulfillApiError(route, 404, 'PERSON_NOT_FOUND', 'Person not found');
      return true;
    }
    person.handles = [...person.handles, ...duplicate.handles];
    person.updatedAt = new Date().toISOString();
    state.people = state.people.filter((candidate) => candidate.id !== duplicate.id);
    for (const saved of state.savedSearches) {
      if (saved.filters.personId === duplicate.id) saved.filters.personId = person.id;
    }
    await fulfillJson(route, toResponse(state, person));
    return true;
  }

  if (!match[2] && request.method() === 'PATCH') {
    const { name } = request.postDataJSON() as components['schemas']['UpdatePersonDto'];
    person.name = name.trim();
    person.updatedAt = new Date().toISOString();
    await fulfillJson(route, toResponse(state, person));
    return true;
  }

  if (!match[2] && request.method() === 'DELETE') {
    state.people = state.people.filter((candidate) => candidate.id !== person.id);
    for (const saved of state.savedSearches) {
      if (saved.filters.personId === person.id) saved.filters.personId = null;
    }
    await fulfillJson(route, { success: true });
    return true;
  }

  return false;
}
