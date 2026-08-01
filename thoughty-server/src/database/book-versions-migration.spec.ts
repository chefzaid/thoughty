import type { QueryRunner } from 'typeorm';
import { BookVersions1784937600000 } from './migrations/1784937600000-book-versions';

describe('BookVersions1784937600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates user-scoped immutable book artifacts and version uniqueness', async () => {
    await new BookVersions1784937600000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE book_versions');
    expect(sql).toContain('content BYTEA NOT NULL');
    expect(sql).toContain('UNIQUE(user_id, scope_key, version_number)');
    expect(sql).toContain('REFERENCES users(id) ON DELETE CASCADE');
  });

  it('drops the book versions table', async () => {
    await new BookVersions1784937600000().down(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith('DROP TABLE IF EXISTS book_versions');
  });
});
