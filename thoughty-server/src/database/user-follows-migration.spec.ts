import type { QueryRunner } from 'typeorm';
import { UserFollows1785369600000 } from './migrations/1785369600000-user-follows';

describe('UserFollows1785369600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates a unique, self-excluding follow relation indexed by followed user', async () => {
    await new UserFollows1785369600000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE user_follows');
    expect(sql).toContain('PRIMARY KEY (follower_id, followed_id)');
    expect(sql).toContain('CHECK (follower_id <> followed_id)');
    expect(sql).toContain('ON DELETE CASCADE');
    expect(sql).toContain('CREATE INDEX idx_user_follows_followed_id');
  });

  it('drops the follow relation', async () => {
    await new UserFollows1785369600000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP TABLE IF EXISTS user_follows');
  });
});
