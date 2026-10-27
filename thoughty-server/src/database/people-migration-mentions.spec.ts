import { extractMentionHandles } from '@/common/utils/entry-mentions.util';
import { syncEntryMentions } from '@/modules/entries/entry-mentions.sync';
import { extractMigrationMentionHandles, linkMigrationEntryMentions } from './migrations/frozen/1786665600000-people-mentions';

/**
 * The people migration links existing entries with a frozen copy of the mention rules. The corpus
 * below records what that copy reads; the last checks compare it with the app's current parser and
 * linking, which were the same when the migration was written. If the app's mention rules change on
 * purpose, keep the frozen copy and its recorded results, drop the comparison for the changed cases,
 * and relink existing entries in a new migration if they must follow.
 */
const CORPUS: ReadonlyArray<[string, string[]]> = [
  ['Lunch with @Marie and @Jean-Paul.', ['Marie', 'Jean-Paul']],
  ['@李雷 meets @محمد, @Ольга and @Zoë-2 or @marie_c', ['李雷', 'محمد', 'Ольга', 'Zoë-2', 'marie_c']],
  ['(@Anna) "@Ben" *@Cleo* _@Dan_ **@Eve** @Fay\n@Gus', ['Anna', 'Ben', 'Cleo', 'Dan', 'Eve', 'Fay', 'Gus']],
  ["@Marie's book, @Paul! @Lea? @Max- and @Ivy_ or @Kim--then", ['Marie', 'Paul', 'Lea', 'Max', 'Ivy', 'Kim']],
  ['marie@example.com, @example.com, site.com/@bob, \\@escaped, @2pm, @@double, a+@b, x-@y', []],
  ['Inline `@code` and ``@double `ticks` @inside``. Then @After', ['After']],
  ['```js\n@fenced\n```\n~~~\n@tilde\n~~~\n  ```\n@indented fence\n  ```\n@Out', ['Out']],
  ['```\n@unclosed fence', []],
  ['a lone ` then @Open', ['Open']],
  ['[[2024-01-01#2]] [[@Inside]] [@Linked](https://x.com/@a) ![@alt](img.png) [@Bracket] text', ['Bracket']],
  ['https://medium.com/@bob www.x.com/@c <https://a.b/@d> <mailto:me@x.org> http://x.org/?u=@e @Real', ['Real']],
  ['@Marie met @marie, @MARIE and @Bob', ['Marie', 'Bob']],
  ['@Élodie and @Elodie and @Élodie', ['Élodie', 'Elodie']],
  ['@İstanbul and @ǅemal and @ß', ['İstanbul', 'ǅemal', 'ß']],
  [`@${'a'.repeat(51)} @${'b'.repeat(50)} @${'İ'.repeat(26)} @${'İ'.repeat(25)}`, ['b'.repeat(50), 'İ'.repeat(25)]],
  ['@a-b_c-d @x--y @z__w @-q @_r', ['a-b_c-d', 'x', 'z']],
  ['', []],
  ['no mention here', []],
  ['trailing @', []],
];

const recordedHandles = (content: string) => extractMigrationMentionHandles(content).map(({ written }) => written);

interface RecordedQuery {
  sql: string;
  parameters: unknown[] | undefined;
}

/** A query runner that answers the linking's reads from a writer's existing handles and people count. */
function recordingRunner(knownHandles: Record<string, number>, peopleCount: number) {
  const queries: RecordedQuery[] = [];
  let nextPersonId = 100;
  return {
    queries,
    query: async (sql: string, parameters?: unknown[]): Promise<unknown> => {
      queries.push({ sql, parameters });
      if (sql.includes('FROM person_handles')) {
        return (parameters![1] as string[]).filter((handle) => handle in knownHandles).map((handle) => ({ handle, personId: knownHandles[handle] }));
      }
      if (sql.includes('COUNT(*)')) return [{ count: peopleCount }];
      if (sql.includes('INSERT INTO person_handles')) {
        return (parameters![1] as string[]).map((handle) => ({ handle, personId: nextPersonId++ }));
      }
      return [];
    },
  };
}

const manyMentions = Array.from({ length: 60 }, (_, index) => `@p${index}`).join(' ');

const SCENARIOS: ReadonlyArray<{ name: string; known: Record<string, number>; count: number; entries: Array<{ id: number; content: string | null }> }> = [
  { name: 'no entries', known: {}, count: 0, entries: [] },
  { name: 'entries that mention no one', known: {}, count: 0, entries: [{ id: 1, content: 'mail me@x.org' }, { id: 2, content: null }] },
  {
    name: 'known and new people across entries',
    known: { marie: 7 },
    count: 3,
    entries: CORPUS.map(([content], index) => ({ id: index + 1, content })),
  },
  { name: 'a writer at the people limit', known: { bob: 4 }, count: 1000, entries: [{ id: 5, content: '@Bob and @NewOne' }] },
  { name: 'a writer just under the limit', known: {}, count: 998, entries: [{ id: 6, content: '@One @Two @Three' }] },
  { name: 'an entry past the mention limit', known: { p0: 1 }, count: 10, entries: [{ id: 8, content: manyMentions }] },
];

describe('people migration mention rules (frozen 1786665600000)', () => {
  it.each(CORPUS)('reads %j as recorded', (content, expected) => {
    expect(recordedHandles(content)).toEqual(expected);
  });

  it('keys handles by their lower-case composed form', () => {
    expect(extractMigrationMentionHandles('@ÉLODIE @ÉLODIE @Bob')).toEqual([
      { handle: 'élodie', written: 'ÉLODIE' },
      { handle: 'bob', written: 'Bob' },
    ]);
  });

  it.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))('links %s', async (_name, { known, count, entries }) => {
    const db = recordingRunner(known, count);
    await linkMigrationEntryMentions(db, 42, entries);

    if (entries.length === 0) {
      expect(db.queries).toEqual([]);
      return;
    }
    expect(db.queries.at(-1)?.sql).toMatch(/^(INSERT INTO entry_people|DELETE FROM entry_people)/);
  });

  it('adds at most the room left under the people limit and links at most 50 people per entry', async () => {
    const atLimit = recordingRunner({ bob: 4 }, 1000);
    await linkMigrationEntryMentions(atLimit, 42, [{ id: 5, content: '@Bob and @NewOne' }]);
    expect(atLimit.queries.some(({ sql }) => sql.includes('INSERT INTO people'))).toBe(false);
    expect(atLimit.queries.at(-1)?.parameters).toEqual([[5], [4]]);

    const underLimit = recordingRunner({}, 998);
    await linkMigrationEntryMentions(underLimit, 42, [{ id: 6, content: '@One @Two @Three' }]);
    const created = underLimit.queries.find(({ sql }) => sql.includes('INSERT INTO people'));
    expect(created?.parameters).toEqual([42, ['one', 'two'], ['One', 'Two']]);

    const crowded = recordingRunner({}, 0);
    await linkMigrationEntryMentions(crowded, 42, [{ id: 8, content: manyMentions }]);
    expect((crowded.queries.at(-1)?.parameters?.[1] as number[]).length).toBe(50);
  });

  describe('matches the app as it was when the migration was written', () => {
    it.each(CORPUS)('reads %j like the app parser', (content) => {
      expect(extractMigrationMentionHandles(content)).toEqual(extractMentionHandles(content));
    });

    it.each(SCENARIOS.map((scenario) => [scenario.name, scenario] as const))('links %s with the same queries', async (_name, { known, count, entries }) => {
      const frozen = recordingRunner(known, count);
      const live = recordingRunner(known, count);
      await linkMigrationEntryMentions(frozen, 42, entries);
      await syncEntryMentions(live, 42, entries);

      expect(frozen.queries).toEqual(live.queries);
    });
  });
});
