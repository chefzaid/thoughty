import type { QueryRunner } from 'typeorm';
import { EntryComments1785456000000 } from './migrations/1785456000000-entry-comments';

describe('EntryComments1785456000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates bounded, non-blank comments that cascade with their entry and author', async () => {
    await new EntryComments1785456000000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE entry_comments');
    expect(sql).toContain('REFERENCES entries(id) ON DELETE CASCADE');
    expect(sql).toContain('REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('content VARCHAR(1000) NOT NULL');
    expect(sql).toContain('CREATE INDEX idx_entry_comments_entry_created');
  });

  it('drops the comments table', async () => {
    await new EntryComments1785456000000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP TABLE IF EXISTS entry_comments');
  });
});
