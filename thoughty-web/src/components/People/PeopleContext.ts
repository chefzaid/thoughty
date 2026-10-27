import { createContext, useContext } from 'react';

import type { Person } from '../../services/api/peopleService';

/** The writer's people, for mention links in their entries and `@` suggestions while they write. */
export interface MentionPeople {
  readonly people: readonly Person[];
  /** Each handle, to the person it mentions. */
  readonly byHandle: ReadonlyMap<string, Person>;
}

export const NO_MENTION_PEOPLE: MentionPeople = { people: [], byHandle: new Map() };

export const MentionPeopleContext = createContext<MentionPeople>(NO_MENTION_PEOPLE);

/** The writer's people; none outside their journal (as in the public feed), where mentions stay text. */
export function useMentionPeople(): MentionPeople {
  return useContext(MentionPeopleContext);
}
