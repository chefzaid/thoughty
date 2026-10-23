import type { QueryRunner } from 'typeorm';
import { EntryMood1786147200000 } from './migrations/1786147200000-entry-mood';

describe('EntryMood1786147200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sqlOf = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('adds an optional mood from 1 to 5 and feeling words to entries and their revisions', async () => {
    await new EntryMood1786147200000().up(queryRunner);

    const sql = sqlOf();
    expect(sql).toMatch(/ALTER TABLE entries\s+ADD COLUMN mood SMALLINT,\s+ADD COLUMN feelings TEXT\[\] NOT NULL DEFAULT '\{\}',\s+ADD CONSTRAINT chk_entries_mood CHECK \(mood BETWEEN 1 AND 5\);/);
    expect(sql).toMatch(/ALTER TABLE entry_revisions\s+ADD COLUMN mood SMALLINT,\s+ADD COLUMN feelings TEXT\[\] NOT NULL DEFAULT '\{\}',\s+ADD CONSTRAINT chk_entry_revisions_mood/);
    expect(sql).toMatch(/CREATE INDEX idx_entries_user_mood_date\s+ON entries\(user_id, mood, date\)\s+WHERE mood IS NOT NULL;/);
  });

  it('drops the index before the columns on rollback', async () => {
    await new EntryMood1786147200000().down(queryRunner);

    const sql = sqlOf();
    const order = [
      'DROP INDEX IF EXISTS idx_entries_user_mood_date',
      'ALTER TABLE entry_revisions',
      'ALTER TABLE entries',
    ].map((statement) => sql.indexOf(statement));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
    expect(sql.match(/DROP COLUMN IF EXISTS mood/g)).toHaveLength(2);
  });
});
