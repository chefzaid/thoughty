import type { QueryRunner } from 'typeorm';
import { MessageEntries1790899200000 } from './migrations/1790899200000-message-entries';

describe('MessageEntries1790899200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('lets a message share an entry, the reference cleared when the entry is deleted for good', async () => {
    await new MessageEntries1790899200000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(1);
    expect(sql()).toContain(
      'ALTER TABLE messages ADD COLUMN entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL',
    );
    expect(sql()).toContain(
      'CREATE INDEX idx_messages_entry ON messages(entry_id) WHERE entry_id IS NOT NULL',
    );
  });

  it('drops the index and the column', async () => {
    await new MessageEntries1790899200000().down(queryRunner);

    expect(sql().indexOf('DROP INDEX IF EXISTS idx_messages_entry')).toBeLessThan(
      sql().indexOf('ALTER TABLE messages DROP COLUMN IF EXISTS entry_id'),
    );
  });
});
