import type { QueryRunner } from 'typeorm';
import { Conversations1790812800000 } from './migrations/1790812800000-conversations';

describe('Conversations1790812800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps conversations, their writers and messages, one conversation per pair, gone with an account', async () => {
    await new Conversations1790812800000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(sql()).toContain('direct_low_id INTEGER REFERENCES users(id) ON DELETE CASCADE');
    expect(sql()).toContain(
      'CONSTRAINT uq_conversations_direct UNIQUE (direct_low_id, direct_high_id)',
    );
    expect(sql()).toContain('CHECK (direct_low_id < direct_high_id)');
    expect(sql()).toContain('last_read_message_id INTEGER NOT NULL DEFAULT 0');
    expect(sql()).toContain('PRIMARY KEY (conversation_id, user_id)');
    expect(sql()).toContain('sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql()).toContain('body VARCHAR(2000) NOT NULL');
    expect(sql()).toContain(
      'CREATE INDEX idx_messages_conversation ON messages(conversation_id, id)',
    );
  });

  it('drops the messages before the conversations they belong to', async () => {
    await new Conversations1790812800000().down(queryRunner);

    expect(sql().indexOf('DROP TABLE IF EXISTS messages')).toBeLessThan(
      sql().indexOf('DROP TABLE IF EXISTS conversations;'),
    );
    expect(sql()).toContain('DROP TABLE IF EXISTS conversation_members');
  });
});
