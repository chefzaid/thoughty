import type { QueryRunner } from 'typeorm';
import { MessageDeletions1790985600000 } from './migrations/1790985600000-message-deletions';

describe('MessageDeletions1790985600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps what each writer deleted for themselves, gone with the message or the account', async () => {
    await new MessageDeletions1790985600000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(sql()).toContain(
      'ALTER TABLE conversation_members ADD COLUMN deleted_up_to_message_id INTEGER NOT NULL DEFAULT 0',
    );
    expect(sql()).toContain(
      'message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE',
    );
    expect(sql()).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql()).toContain('PRIMARY KEY (message_id, user_id)');
    expect(sql()).toContain(
      'CREATE INDEX idx_message_deletions_user ON message_deletions(user_id)',
    );
  });

  it('drops the table and the column', async () => {
    await new MessageDeletions1790985600000().down(queryRunner);

    expect(sql()).toContain('DROP TABLE IF EXISTS message_deletions');
    expect(sql()).toContain(
      'ALTER TABLE conversation_members DROP COLUMN IF EXISTS deleted_up_to_message_id',
    );
  });
});
