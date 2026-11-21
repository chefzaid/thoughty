import type { QueryRunner } from 'typeorm';
import { MuteAndBlock1788652800000 } from './migrations/1788652800000-mute-and-block';

describe('MuteAndBlock1788652800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one mute and one block per pair of writers, never of oneself, gone with either account', async () => {
    await new MuteAndBlock1788652800000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain('CREATE TABLE user_mutes');
    expect(statement).toContain('muted_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(statement).toContain('PRIMARY KEY (user_id, muted_id)');
    expect(statement).toContain('CHECK (user_id <> muted_id)');
    expect(statement).toContain('CREATE TABLE user_blocks');
    expect(statement).toContain(
      'blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE',
    );
    expect(statement).toContain(
      'blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE',
    );
    expect(statement).toContain('PRIMARY KEY (blocker_id, blocked_id)');
    expect(statement).toContain('CHECK (blocker_id <> blocked_id)');
    expect(statement).toContain('CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id)');
  });

  it('drops both tables', async () => {
    await new MuteAndBlock1788652800000().down(queryRunner);

    expect(sql()).toBe('DROP TABLE IF EXISTS user_blocks; DROP TABLE IF EXISTS user_mutes;');
  });
});
