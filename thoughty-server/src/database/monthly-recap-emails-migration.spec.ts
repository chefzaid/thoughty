import type { QueryRunner } from 'typeorm';
import { MonthlyRecapEmails1786838400000 } from './migrations/1786838400000-monthly-recap-emails';

describe('MonthlyRecapEmails1786838400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates one opt-in row per writer, off by default, with a due-send index over the enabled rows', async () => {
    await new MonthlyRecapEmails1786838400000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE monthly_recap_emails');
    expect(sql).toContain('user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('enabled BOOLEAN NOT NULL DEFAULT FALSE');
    expect(sql).toContain('diary_id INTEGER REFERENCES diaries(id) ON DELETE SET NULL');
    expect(sql).toContain('next_send_at TIMESTAMPTZ NOT NULL');
    expect(sql).toContain('last_sent_on DATE');
    expect(sql).toContain('CHECK (delivery_hour BETWEEN 0 AND 23)');
    expect(sql).toMatch(/CREATE INDEX idx_monthly_recap_emails_due\s+ON monthly_recap_emails\(next_send_at\)\s+WHERE enabled/);
  });

  it('drops the table', async () => {
    await new MonthlyRecapEmails1786838400000().down(queryRunner);

    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('DROP TABLE IF EXISTS monthly_recap_emails');
  });
});
