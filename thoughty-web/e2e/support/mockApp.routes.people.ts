import type { components } from '../../src/generated/openapi';
import { findMentions } from '../../src/utils/mentions';
import type { MockAppState, MockEntry } from './mockApp.shared';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';
import { mockMergedPersonDates, mockPersonDatesRefusal, mockSavedPersonDates } from './mockApp.person-dates';
import { mockContactRefusal, mockLastMentionedOn } from './mockApp.reach-outs';
import { mockMentionsOverTime } from './mockApp.person-mentions';

export const MOCK_PEOPLE_LIMIT = 1000;

type PersonResponse = components['schemas']['PersonResponseDto'];
/** What a spec may leave out of a person, which then reads as none. */
type MockPersonOptional = 'dates' | 'reachOutDays' | 'lastContactOn' | 'notes' | 'groups';
/**
 * A person as the mock keeps them; their counts are read from the entries' text on each request. A spec may
 * leave out their dates, the reach-out reminder, the last contact, the notes and the groups.
 */
export type MockPerson = Omit<PersonResponse, 'entryCount' | 'lastMentionedOn' | MockPersonOptional>
  & Partial<Pick<PersonResponse, MockPersonOptional>>;

/** The longest notes the API saves on a person. */
const MOCK_PERSON_NOTES_MAX_LENGTH = 2000;
/** The most groups, and the longest group name, the API saves on a person. */
const MOCK_PERSON_GROUPS_MAX = 10;
const MOCK_PERSON_GROUP_NAME_MAX_LENGTH = 40;

const groupKey = (name: string) => name.toLocaleLowerCase();

/** The groups as the API saves them: trimmed, once each ignoring case, spelled as on the writer's other people. */
function mockSavedGroups(state: MockAppState, person: MockPerson, groups: readonly string[]): string[] {
  const others = state.people.filter((candidate) => candidate.id !== person.id).flatMap((candidate) => candidate.groups ?? []).sort();
  const saved: string[] = [];
  for (const name of groups.map((group) => group.trim())) {
    if (saved.some((group) => groupKey(group) === groupKey(name))) continue;
    saved.push(others.find((group) => groupKey(group) === groupKey(name)) ?? name);
  }
  return saved;
}

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
  return {
    ...person,
    dates: person.dates ?? [],
    reachOutDays: person.reachOutDays ?? null,
    lastContactOn: person.lastContactOn ?? null,
    notes: person.notes ?? null,
    groups: person.groups ?? [],
    entryCount: entries.length,
    lastMentionedOn: mockLastMentionedOn(entries),
  };
}

const byName = (left: MockPerson, right: MockPerson) => left.name.toLowerCase().localeCompare(right.name.toLowerCase()) || left.id - right.id;

/**
 * `/api/people` as the API answers it: people by name with their counts outside the recycle bin, renaming the
 * name shown and setting their dates, reminder, last contact, notes and groups (refused with the API's codes), recording a
 * contact today, the mentions over time of a person or a group (`mockMentionsOverTime`), merging a duplicate (its handles move, its reminder too when the person kept has none, the later
 * contact stays, its notes, groups and dates follow the person's, saved searches follow) and deleting (saved searches widen).
 */
export async function handlePeopleRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === '/api/people' && request.method() === 'GET') {
    await fulfillJson(route, { people: [...state.people].sort(byName).map((person) => toResponse(state, person)), limit: MOCK_PEOPLE_LIMIT });
    return true;
  }

  const today = searchParams.get('today') ?? new Date().toISOString().slice(0, 10);
  if (pathname === '/api/people/mentions-over-time' && request.method() === 'GET') {
    const group = groupKey(searchParams.get('group')?.trim() ?? '');
    if (!group) {
      await fulfillApiError(route, 400, 'VALIDATION_FAILED', 'group should not be empty');
      return true;
    }
    const inGroup = state.people.filter((person) => (person.groups ?? []).some((name) => groupKey(name) === group));
    await fulfillJson(route, mockMentionsOverTime(state, (entry) => inGroup.some((person) => mockMentions(entry, person)), today));
    return true;
  }

  const match = /^\/api\/people\/(\d+)(\/merge|\/contacted|\/mentions-over-time)?$/.exec(pathname);
  if (!match) return false;
  const person = state.people.find((candidate) => candidate.id === Number(match[1]));
  if (!person) {
    await fulfillApiError(route, 404, 'PERSON_NOT_FOUND', 'Person not found');
    return true;
  }

  if (match[2] === '/mentions-over-time' && request.method() === 'GET') {
    await fulfillJson(route, mockMentionsOverTime(state, (entry) => mockMentions(entry, person), today));
    return true;
  }

  if (match[2] === '/contacted' && request.method() === 'POST') {
    const { today } = request.postDataJSON() as components['schemas']['MarkPersonContactedDto'];
    person.lastContactOn = today;
    person.updatedAt = new Date().toISOString();
    await fulfillJson(route, toResponse(state, person));
    return true;
  }

  if (match[2] === '/merge' && request.method() === 'POST') {
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
    person.dates = mockMergedPersonDates(person.dates ?? [], duplicate.dates ?? []);
    person.reachOutDays ??= duplicate.reachOutDays ?? null;
    person.lastContactOn = [person.lastContactOn, duplicate.lastContactOn].filter(Boolean).sort().at(-1) ?? null;
    person.notes = [person.notes, duplicate.notes].filter(Boolean).join('\n\n') || null;
    const kept = person.groups ?? [];
    person.groups = [...kept, ...(duplicate.groups ?? []).filter((group) => !kept.some((own) => groupKey(own) === groupKey(group)))];
    person.updatedAt = new Date().toISOString();
    state.people = state.people.filter((candidate) => candidate.id !== duplicate.id);
    for (const saved of state.savedSearches) {
      if (saved.filters.personId === duplicate.id) saved.filters.personId = person.id;
    }
    await fulfillJson(route, toResponse(state, person));
    return true;
  }

  if (!match[2] && request.method() === 'PATCH') {
    const { name, dates, reachOutDays, lastContactOn, notes, groups } = request.postDataJSON() as components['schemas']['UpdatePersonDto'];
    const savedNotes = typeof notes === 'string' ? notes.trim() || null : notes;
    if (savedNotes && savedNotes.length > MOCK_PERSON_NOTES_MAX_LENGTH) {
      await fulfillApiError(route, 400, 'VALIDATION_FAILED', 'notes must be shorter than or equal to 2000 characters');
      return true;
    }
    if (groups && (groups.length > MOCK_PERSON_GROUPS_MAX
      || groups.some((group) => !group.trim() || group.trim().length > MOCK_PERSON_GROUP_NAME_MAX_LENGTH))) {
      await fulfillApiError(route, 400, 'VALIDATION_FAILED', 'groups must hold at most 10 names of 1 to 40 characters');
      return true;
    }
    const refusal = (dates ? mockPersonDatesRefusal(dates) : null) ?? (lastContactOn ? mockContactRefusal(lastContactOn) : null);
    if (refusal) {
      await fulfillApiError(route, 400, refusal.code, refusal.message);
      return true;
    }
    person.name = name.trim();
    if (dates !== undefined) person.dates = mockSavedPersonDates(dates);
    if (reachOutDays !== undefined) person.reachOutDays = reachOutDays;
    if (lastContactOn !== undefined) person.lastContactOn = lastContactOn;
    if (savedNotes !== undefined) person.notes = savedNotes;
    if (groups !== undefined) person.groups = mockSavedGroups(state, person, groups);
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
