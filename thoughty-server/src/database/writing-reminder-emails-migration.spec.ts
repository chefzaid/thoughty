import type { QueryRunner } from 'typeorm';
import { WritingReminderEmails1789171200000 } from './migrations/1789171200000-writing-reminder-emails';

describe('WritingReminderEmails1789171200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates one opt-in row per writer, off by default, with a due-send index over the enabled rows', async () => {
    await new WritingReminderEmails1789171200000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE writing_reminder_emails');
    expect(sql).toContain('user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('enabled BOOLEAN NOT NULL DEFAULT FALSE');
    expect(sql).toContain('diary_id INTEGER REFERENCES diaries(id) ON DELETE SET NULL');
    expect(sql).toContain('next_send_at TIMESTAMPTZ NOT NULL');
    expect(sql).toContain('last_sent_on DATE');
    expect(sql).toContain('CHECK (delivery_hour BETWEEN 0 AND 23)');
    expect(sql).toMatch(/CREATE INDEX idx_writing_reminder_emails_due\s+ON writing_reminder_emails\(next_send_at\)\s+WHERE enabled/);
  });

  it('drops the table', async () => {
    await new WritingReminderEmails1789171200000().down(queryRunner);

    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('DROP TABLE IF EXISTS writing_reminder_emails');
  });
});
