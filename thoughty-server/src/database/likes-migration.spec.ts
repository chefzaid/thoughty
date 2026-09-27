import type { QueryRunner } from 'typeorm';
import { Likes1785542400000 } from './migrations/1785542400000-likes';

describe('Likes1785542400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates one-like-per-user tables for entries and comments', async () => {
    await new Likes1785542400000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE entry_likes');
    expect(sql).toContain('PRIMARY KEY (entry_id, user_id)');
    expect(sql).toContain('CREATE TABLE comment_likes');
    expect(sql).toContain('REFERENCES entry_comments(id) ON DELETE CASCADE');
    expect(sql).toContain('PRIMARY KEY (comment_id, user_id)');
  });

  it('drops both like tables', async () => {
    await new Likes1785542400000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP TABLE IF EXISTS comment_likes');
    expect(sql).toContain('DROP TABLE IF EXISTS entry_likes');
  });
});
