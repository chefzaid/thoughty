import type { QueryRunner } from 'typeorm';
import { NotificationReads1789776000000 } from './migrations/1789776000000-notification-reads';

describe('NotificationReads1789776000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = (call: number) => (queryRunner.query as jest.Mock).mock.calls[call][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one read time per account, gone with it, and starts every existing account from now', async () => {
    await new NotificationReads1789776000000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(2);
    expect(sql(0)).toContain('CREATE TABLE notification_reads');
    expect(sql(0)).toContain('user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE');
    expect(sql(0)).toContain('read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP');
    expect(sql(1)).toBe('INSERT INTO notification_reads (user_id) SELECT id FROM users;');
  });

  it('drops the table', async () => {
    await new NotificationReads1789776000000().down(queryRunner);

    expect(sql(0)).toBe('DROP TABLE IF EXISTS notification_reads;');
  });
});
