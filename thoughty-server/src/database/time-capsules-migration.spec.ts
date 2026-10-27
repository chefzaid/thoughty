import type { QueryRunner } from 'typeorm';
import { TimeCapsules1786924800000 } from './migrations/1786924800000-time-capsules';

describe('TimeCapsules1786924800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sqlOf = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('marks sealed entries, which stay private, and keeps their sealed copy in a table of its own', async () => {
    await new TimeCapsules1786924800000().up(queryRunner);

    const sql = sqlOf();
    expect(sql).toMatch(/ALTER TABLE entries\s+ADD COLUMN sealed_until TIMESTAMPTZ,/);
    expect(sql).toContain("CHECK (sealed_until IS NULL OR visibility = 'private')");
    expect(sql).toContain('CREATE TABLE time_capsules');
    expect(sql).toContain('entry_id INTEGER NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE');
    expect(sql).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('open_at TIMESTAMPTZ NOT NULL');
    expect(sql).toContain('sealed_content TEXT,');
    expect(sql).toContain('CHECK (open_hour BETWEEN 0 AND 23)');
    expect(sql).toContain('CHECK ((opened_at IS NULL) = (sealed_content IS NOT NULL))');
  });

  it('indexes the capsules still to open by their time, and the opened ones by writer', async () => {
    await new TimeCapsules1786924800000().up(queryRunner);

    const sql = sqlOf();
    expect(sql).toMatch(/CREATE INDEX idx_time_capsules_due\s+ON time_capsules\(open_at\)\s+WHERE opened_at IS NULL/);
    expect(sql).toMatch(/CREATE INDEX idx_time_capsules_user_opened\s+ON time_capsules\(user_id, opened_at\)\s+WHERE opened_at IS NOT NULL/);
  });

  it('puts sealed text back into its entries before dropping the table and the column', async () => {
    await new TimeCapsules1786924800000().down(queryRunner);

    const sql = sqlOf();
    const order = [
      'UPDATE entries e',
      'content = tc.sealed_content',
      'WHERE tc.entry_id = e.id AND tc.opened_at IS NULL',
      'DROP TABLE IF EXISTS time_capsules',
      'DROP COLUMN IF EXISTS sealed_until',
    ].map((statement) => sql.indexOf(statement));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });
});
