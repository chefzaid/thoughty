// Relative, as the people migration loads this file too
import { extractMentionHandles } from '../../common/utils/entry-mentions.util';

/** How many people one writer can keep; mentions of new people past it stay plain text. */
export const PEOPLE_LIMIT = 1000;
/** How many distinct people one entry can be linked to; later mentions in it stay plain text. */
export const ENTRY_MENTION_LIMIT = 50;
/** Namespace of the advisory lock that serializes adding one writer's people. */
export const PEOPLE_LOCK_NAMESPACE = 'people';

/** Runs SQL inside the caller's transaction: an entity manager or a migration's query runner. */
export interface SqlRunner {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

export interface MentioningEntry {
  readonly id: number;
  readonly content: string | null | undefined;
}

/**
 * Links each entry to the people its text mentions, replacing the links it had. A handle no person
 * holds yet adds a person named as the handle was first written, while the writer is under
 * {@link PEOPLE_LIMIT}. Runs inside the caller's transaction, so an entry and its links change together.
 */
export async function syncEntryMentions(db: SqlRunner, userId: number, entries: readonly MentioningEntry[]): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const mentioned = entries.map((entry) => ({
    id: entry.id,
    handles: extractMentionHandles(entry.content ?? '').slice(0, ENTRY_MENTION_LIMIT),
  }));
  const firstWritten = new Map<string, string>();
  for (const { handles } of mentioned) {
    for (const { handle, written } of handles) {
      if (!firstWritten.has(handle)) firstWritten.set(handle, written);
    }
  }
  const people = firstWritten.size > 0 ? await resolvePeople(db, userId, firstWritten) : new Map<string, number>();

  const links = new Map<string, [number, number]>();
  for (const { id, handles } of mentioned) {
    for (const { handle } of handles) {
      const personId = people.get(handle);
      if (personId !== undefined) links.set(`${id}:${personId}`, [id, personId]);
    }
  }

  await db.query('DELETE FROM entry_people WHERE entry_id = ANY($1::int[])', [entries.map((entry) => entry.id)]);
  if (links.size > 0) {
    const pairs = [...links.values()];
    await db.query(
      'INSERT INTO entry_people (entry_id, person_id) SELECT * FROM unnest($1::int[], $2::int[]) ON CONFLICT DO NOTHING',
      [pairs.map(([entryId]) => entryId), pairs.map(([, personId]) => personId)],
    );
  }
}

/** The person of each handle, adding the people that do not exist yet while there is room. */
async function resolvePeople(db: SqlRunner, userId: number, firstWritten: Map<string, string>): Promise<Map<string, number>> {
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [PEOPLE_LOCK_NAMESPACE, userId]);
  const known = (await db.query(
    'SELECT handle, person_id AS "personId" FROM person_handles WHERE user_id = $1 AND handle = ANY($2::text[])',
    [userId, [...firstWritten.keys()]],
  )) as Array<{ handle: string; personId: number }>;
  const people = new Map(known.map((row) => [row.handle, Number(row.personId)]));

  const missing = [...firstWritten].filter(([handle]) => !people.has(handle));
  if (missing.length === 0) {
    return people;
  }
  const [{ count }] = (await db.query('SELECT COUNT(*)::int AS count FROM people WHERE user_id = $1', [userId])) as Array<{ count: number }>;
  const adding = missing.slice(0, Math.max(0, PEOPLE_LIMIT - Number(count)));
  if (adding.length === 0) {
    return people;
  }

  // Each new handle was first written differently, so the name finds the handle of each new person
  const added = (await db.query(
    `WITH input AS (SELECT * FROM unnest($2::text[], $3::text[]) AS t(handle, name)),
          created AS (INSERT INTO people (user_id, name) SELECT $1, name FROM input RETURNING id, name)
     INSERT INTO person_handles (person_id, user_id, handle)
     SELECT created.id, $1, input.handle FROM created JOIN input ON input.name = created.name
     RETURNING handle, person_id AS "personId"`,
    [userId, adding.map(([handle]) => handle), adding.map(([, written]) => written)],
  )) as Array<{ handle: string; personId: number }>;
  for (const row of added) {
    people.set(row.handle, Number(row.personId));
  }
  return people;
}
