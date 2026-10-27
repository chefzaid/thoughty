/**
 * The mention rules and linking of the people migration (`1786665600000-people.ts`), frozen as they
 * were when it was written (`src/common/utils/entry-mentions.util.ts` and
 * `src/modules/entries/entry-mentions.sync.ts` of that release), so the migration links the same
 * entries on any database whenever it runs. Never change this file and never import it from
 * application code: a later change to the mention syntax belongs in the app and, if existing
 * entries must follow, in a new migration. This folder is outside the migrations glob, so TypeORM
 * does not load it as a migration.
 */

const MENTION_HANDLE_MAX_LENGTH = 50;
const PEOPLE_LIMIT = 1000;
const ENTRY_MENTION_LIMIT = 50;
const PEOPLE_LOCK_NAMESPACE = 'people';

const MENTION_PATTERN =
  /(?<![\p{L}\p{M}\p{N}.@/\\+`-])@([\p{L}][\p{L}\p{M}\p{N}]*(?:[-_][\p{L}\p{M}\p{N}]+)*)(?![\p{L}\p{M}\p{N}@]|[.\-_][\p{L}\p{M}\p{N}])/gu;

const EXCLUDED_PATTERNS: readonly RegExp[] = [
  /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))/gm,
  /(`+)[\s\S]*?\1/g,
  /\[\[[^\]\n]*\]\]/g,
  /!?\[[^\]\n]*\]\([^)\n]*\)/g,
  /<[a-z][a-z0-9+.-]*:[^>\s]*>/gi,
  /\b(?:https?:\/\/|www\.)[^\s<>]+/gi,
];

/** Runs SQL inside the migration's transaction. */
export interface MigrationSqlRunner {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}

export interface MigrationMentioningEntry {
  readonly id: number;
  readonly content: string | null | undefined;
}

/** The distinct people the content mentions, each by its key with the way it was first written, in order. */
export function extractMigrationMentionHandles(content: string): Array<{ handle: string; written: string }> {
  if (!content || !content.includes('@')) {
    return [];
  }
  let masked = content;
  for (const pattern of EXCLUDED_PATTERNS) {
    masked = masked.replace(pattern, (match) => match.replace(/[^\n]/g, ' '));
  }
  const seen = new Map<string, string>();
  for (const match of masked.matchAll(MENTION_PATTERN)) {
    const written = match[1];
    const handle = written.normalize('NFC').toLowerCase();
    if (written.length > MENTION_HANDLE_MAX_LENGTH || handle.length > MENTION_HANDLE_MAX_LENGTH) {
      continue;
    }
    if (!seen.has(handle)) {
      seen.set(handle, written);
    }
  }
  return [...seen].map(([handle, written]) => ({ handle, written }));
}

/** Links each entry to the people its text mentions, adding the people that do not exist yet while there is room. */
export async function linkMigrationEntryMentions(
  db: MigrationSqlRunner,
  userId: number,
  entries: readonly MigrationMentioningEntry[],
): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  const mentioned = entries.map((entry) => ({
    id: entry.id,
    handles: extractMigrationMentionHandles(entry.content ?? '').slice(0, ENTRY_MENTION_LIMIT),
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

async function resolvePeople(db: MigrationSqlRunner, userId: number, firstWritten: Map<string, string>): Promise<Map<string, number>> {
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
