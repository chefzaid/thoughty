import type { QueryRunner } from 'typeorm';
import { DiaryWritingReminders1789344000000 } from './migrations/1789344000000-diary-writing-reminders';

describe('DiaryWritingReminders1789344000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates one reminder row per diary, removed with the diary or the account, with a due-send index over the enabled rows', async () => {
    await new DiaryWritingReminders1789344000000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE diary_writing_reminders');
    expect(sql).toContain('diary_id INTEGER PRIMARY KEY REFERENCES diaries(id) ON DELETE CASCADE');
    expect(sql).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('enabled BOOLEAN NOT NULL DEFAULT TRUE');
    expect(sql).toContain('next_send_at TIMESTAMPTZ NOT NULL');
    expect(sql).toContain('last_sent_on DATE');
    expect(sql).toContain('CHECK (delivery_hour BETWEEN 0 AND 23)');
    expect(sql).toContain('CREATE INDEX idx_diary_writing_reminders_user ON diary_writing_reminders(user_id)');
    expect(sql).toMatch(/CREATE INDEX idx_diary_writing_reminders_due\s+ON diary_writing_reminders\(next_send_at\)\s+WHERE enabled/);
  });

  it('drops the table', async () => {
    await new DiaryWritingReminders1789344000000().down(queryRunner);

    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('DROP TABLE IF EXISTS diary_writing_reminders');
  });
});
