/** The most groups the API saves on a person. */
export const PERSON_GROUPS_MAX = 10;
/** The longest group name the API saves. */
export const PERSON_GROUP_NAME_MAX_LENGTH = 40;

/** How groups are told apart: ignoring case, as the API does. */
export const personGroupKey = (name: string) => name.trim().toLocaleLowerCase();

/** A group of the writer's, as the People page's filter lists it: its spelling and how many people are in it. */
export interface PersonGroupSummary {
  readonly key: string;
  readonly name: string;
  readonly count: number;
}

/** Every group the writer's people are in, once each ignoring case (the first spelling met), by name. */
export function collectPersonGroups(people: readonly { readonly groups: readonly string[] }[], locale?: string): PersonGroupSummary[] {
  const groups = new Map<string, { name: string; count: number }>();
  for (const person of people) {
    for (const key of new Set(person.groups.map(personGroupKey))) {
      const name = person.groups.find((group) => personGroupKey(group) === key) ?? key;
      const known = groups.get(key);
      groups.set(key, { name: known?.name ?? name, count: (known?.count ?? 0) + 1 });
    }
  }
  return [...groups].map(([key, group]) => ({ key, ...group }))
    .sort((left, right) => left.name.localeCompare(right.name, locale, { sensitivity: 'base' }) || left.key.localeCompare(right.key));
}

/**
 * The groups once `name` is added: trimmed, left out when blank or already there ignoring case, and spelled as one
 * of the writer's groups (`known`) when it matches one, as the API saves it.
 */
export function addPersonGroup(groups: readonly string[], name: string, known: readonly string[]): string[] {
  const key = personGroupKey(name);
  if (!key || groups.some((group) => personGroupKey(group) === key)) return [...groups];
  return [...groups, known.find((group) => personGroupKey(group) === key) ?? name.trim()];
}

/** Whether two lists hold the same groups in the same order. */
export function samePersonGroups(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((group, index) => group === right[index]);
}
