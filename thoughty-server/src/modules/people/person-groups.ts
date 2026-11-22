/** The most groups a save puts a person in. */
export const PERSON_GROUPS_MAX = 10;
/** The longest group name a save accepts. */
export const PERSON_GROUP_NAME_MAX_LENGTH = 40;

const groupKey = (name: string) => name.toLocaleLowerCase();

/**
 * The groups to save on a person: each name once ignoring case (the first spelling given), written as the writer
 * already spells it on their other people, so `friends` joins an existing `Friends` group instead of starting another.
 */
export function normalizePersonGroups(groups: readonly string[], existing: readonly string[]): string[] {
  const spelling = new Map<string, string>();
  for (const name of existing) {
    if (!spelling.has(groupKey(name))) spelling.set(groupKey(name), name);
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of groups) {
    const key = groupKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(spelling.get(key) ?? name);
  }
  return result;
}
