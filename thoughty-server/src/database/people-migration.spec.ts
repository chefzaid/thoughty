import type { QueryRunner } from 'typeorm';
import { People1786665600000 } from './migrations/1786665600000-people';

describe('People1786665600000', () => {
  let query: jest.Mock;
  let queryRunner: QueryRunner;

  beforeEach(() => {
    query = jest.fn().mockResolvedValue([]);
    queryRunner = { query } as unknown as QueryRunner;
  });

  it('keeps people per writer, their handles once each, and the entries that mention them', async () => {
    await new People1786665600000().up(queryRunner);

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE people');
    expect(sql).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('name VARCHAR(80) NOT NULL');
    expect(sql).toContain("CHECK (btrim(name) <> '')");
    expect(sql).toContain('CREATE TABLE person_handles');
    expect(sql).toContain('PRIMARY KEY (user_id, handle)');
    expect(sql).toContain('person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE');
    expect(sql).toContain('CREATE TABLE entry_people');
    expect(sql).toContain('entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE');
    expect(sql).toContain('PRIMARY KEY (entry_id, person_id)');
    expect(sql).toContain('CREATE INDEX idx_entry_people_person ON entry_people(person_id, entry_id)');
  });

  it('links existing entries that hold an @, batch by batch and writer by writer', async () => {
    query.mockImplementation(async (sql: string, parameters: unknown[] = []) => {
      if (sql.includes('FROM entries')) {
        return parameters[0] === 0
          ? [{ id: 4, userId: 1, content: 'Tea with @Marie' }, { id: 9, userId: 2, content: 'Hi @Bob' }]
          : [];
      }
      if (sql.includes('FROM person_handles')) return [];
      if (sql.includes('COUNT(*)')) return [{ count: 0 }];
      if (sql.includes('INSERT INTO person_handles')) {
        return (parameters[1] as string[]).map((handle, index) => ({ handle, personId: index + 10 }));
      }
      return [];
    });

    await new People1786665600000().up(queryRunner);

    const reads = query.mock.calls.filter(([sql]) => String(sql).includes('FROM entries'));
    expect(reads.map(([, parameters]) => parameters)).toEqual([[0, 500], [9, 500]]);
    const links = query.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT INTO entry_people'));
    expect(links.map(([, parameters]) => parameters)).toEqual([[[4], [10]], [[9], [10]]]);
  });

  it('drops the tables', async () => {
    await new People1786665600000().down(queryRunner);

    expect(query.mock.calls[0][0]).toBe('DROP TABLE IF EXISTS entry_people; DROP TABLE IF EXISTS person_handles; DROP TABLE IF EXISTS people;');
  });
});
