import type { QueryRunner } from 'typeorm';
import { RereadReminders1787529600000 } from './migrations/1787529600000-reread-reminders';

describe('RereadReminders1787529600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('gives each entry one optional reread day, never on a sealed time capsule', async () => {
    await new RereadReminders1787529600000().up(queryRunner);

    expect(sql()).toMatch(/ALTER TABLE entries\s+ADD COLUMN reread_on DATE,/);
    expect(sql()).toContain('CHECK (reread_on IS NULL OR sealed_until IS NULL)');
  });

  it('indexes the reminders by writer and day, leaving out entries without one', async () => {
    await new RereadReminders1787529600000().up(queryRunner);

    expect(sql()).toMatch(
      /CREATE INDEX idx_entries_user_reread_on\s+ON entries\(user_id, reread_on\)\s+WHERE reread_on IS NOT NULL/,
    );
  });

  it('drops the index, the check and the column', async () => {
    await new RereadReminders1787529600000().down(queryRunner);

    const order = [
      'DROP INDEX IF EXISTS idx_entries_user_reread_on',
      'DROP CONSTRAINT IF EXISTS chk_entries_reread_open',
      'DROP COLUMN IF EXISTS reread_on',
    ].map((statement) => sql().indexOf(statement));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });
});
