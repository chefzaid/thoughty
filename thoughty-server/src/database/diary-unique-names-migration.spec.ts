import type { QueryRunner } from 'typeorm';
import { DiaryUniqueNames1787011200000 } from './migrations/1787011200000-diary-unique-names';

describe('DiaryUniqueNames1787011200000', () => {
  const numberedDiaryName = DiaryUniqueNames1787011200000.numberedName;
  const query = jest.fn();
  const queryRunner = { query } as unknown as QueryRunner;
  const statements = () => query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());

  beforeEach(() => jest.resetAllMocks());

  it('numbers a repeated name within the 100 characters of the column', () => {
    expect(numberedDiaryName(' Travel ', 2)).toBe('Travel (2)');
    expect(numberedDiaryName('', 3)).toBe('(3)');
    const long = numberedDiaryName(`${'a'.repeat(95)} ${'b'.repeat(4)}`, 12);
    expect(long).toBe(`${'a'.repeat(95)} (12)`);
    const emoji = numberedDiaryName('📓'.repeat(100), 2);
    expect(Array.from(emoji)).toHaveLength(100);
    expect(emoji.endsWith('📓 (2)')).toBe(true);
  });

  it('locks the table, renames each later duplicate to the first free number, then adds the index', async () => {
    query.mockImplementation(async (sql: string, parameters?: unknown[]) => {
      if (sql.includes('ROW_NUMBER()')) return [{ id: 9, userId: 1, name: 'travel' }];
      if (sql.includes('SELECT EXISTS')) return [{ taken: parameters?.[1] === 'travel (2)' }];
      return [];
    });

    await new DiaryUniqueNames1787011200000().up(queryRunner);

    const sql = statements();
    expect(sql[0]).toBe('LOCK TABLE diaries IN SHARE ROW EXCLUSIVE MODE');
    expect(sql[1]).toContain('PARTITION BY user_id, lower(btrim(name)) ORDER BY created_at, id');
    expect(sql[1]).toContain('WHERE rank > 1');
    expect(query.mock.calls.filter(([statement]) => String(statement).includes('SELECT EXISTS')).map(([, parameters]) => parameters))
      .toEqual([[1, 'travel (2)'], [1, 'travel (3)']]);
    expect(query).toHaveBeenCalledWith('UPDATE diaries SET name = $1 WHERE id = $2', ['travel (3)', 9]);
    expect(sql.at(-1)).toBe('CREATE UNIQUE INDEX uq_diaries_user_name ON diaries (user_id, lower(btrim(name)))');
  });

  it('adds the index straight away when no names repeat', async () => {
    query.mockResolvedValue([]);

    await new DiaryUniqueNames1787011200000().up(queryRunner);

    expect(statements()).toHaveLength(3);
  });

  it('drops the index and keeps the new names', async () => {
    await new DiaryUniqueNames1787011200000().down(queryRunner);

    expect(statements()).toEqual(['DROP INDEX IF EXISTS uq_diaries_user_name']);
  });
});
