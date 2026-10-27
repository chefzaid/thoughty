import { ENTRY_MENTION_LIMIT, PEOPLE_LIMIT, syncEntryMentions } from './entry-mentions.sync';

/** A database where `marie` is person 3 and new people are numbered from 20. */
function fakeDatabase(peopleCount = 1) {
  return {
    query: jest.fn(async (sql: string, parameters: unknown[] = []) => {
      if (sql.includes('FROM person_handles')) {
        return (parameters[1] as string[]).includes('marie') ? [{ handle: 'marie', personId: 3 }] : [];
      }
      if (sql.includes('COUNT(*)')) return [{ count: peopleCount }];
      if (sql.includes('INSERT INTO person_handles')) {
        return (parameters[1] as string[]).map((handle, index) => ({ handle, personId: 20 + index }));
      }
      return [];
    }),
  };
}

const callsTo = (db: ReturnType<typeof fakeDatabase>, start: string) =>
  db.query.mock.calls.filter(([sql]) => String(sql).trimStart().startsWith(start) || String(sql).includes(start));

describe('syncEntryMentions', () => {
  it('does nothing without entries', async () => {
    const db = fakeDatabase();
    await syncEntryMentions(db, 7, []);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('only clears the links of entries that mention no one, without locking', async () => {
    const db = fakeDatabase();
    await syncEntryMentions(db, 7, [{ id: 1, content: 'Alone' }, { id: 2, content: null }]);

    expect(db.query.mock.calls).toEqual([['DELETE FROM entry_people WHERE entry_id = ANY($1::int[])', [[1, 2]]]]);
  });

  it('links known people, adds new ones named as first written, once per entry and person', async () => {
    const db = fakeDatabase();
    await syncEntryMentions(db, 7, [
      { id: 1, content: 'Tea with @Marie and @Jean-Paul, then @marie again' },
      { id: 2, content: '@jean-paul and @Zoë' },
    ]);

    expect(db.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1), $2)', ['people', 7]);
    const [, added] = callsTo(db, 'INSERT INTO person_handles')[0];
    expect(added).toEqual([7, ['jean-paul', 'zoë'], ['Jean-Paul', 'Zoë']]);
    const [, links] = callsTo(db, 'INSERT INTO entry_people')[0];
    expect(links).toEqual([[1, 1, 2, 2], [3, 20, 20, 21]]);
  });

  it('adds no one past the people limit, and links only the people that exist', async () => {
    const db = fakeDatabase(PEOPLE_LIMIT);
    await syncEntryMentions(db, 7, [{ id: 1, content: '@Marie and @Newcomer' }]);

    expect(callsTo(db, 'INSERT INTO person_handles')).toEqual([]);
    expect(callsTo(db, 'INSERT INTO entry_people')[0][1]).toEqual([[1], [3]]);
  });

  it('skips the count when every handle is known, and links at most the entry mention limit', async () => {
    const db = fakeDatabase();
    await syncEntryMentions(db, 7, [{ id: 1, content: '@marie' }]);
    expect(callsTo(db, 'COUNT(*)')).toEqual([]);

    const crowd = Array.from({ length: ENTRY_MENTION_LIMIT + 5 }, (_, index) => `@person${index}x`).join(' ');
    const crowded = fakeDatabase();
    await syncEntryMentions(crowded, 7, [{ id: 1, content: crowd }]);
    expect((callsTo(crowded, 'INSERT INTO person_handles')[0][1] as unknown[][])[1]).toHaveLength(ENTRY_MENTION_LIMIT);
  });
});
