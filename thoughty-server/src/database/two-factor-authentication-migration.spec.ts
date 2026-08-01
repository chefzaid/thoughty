import type { QueryRunner } from 'typeorm';
import { TwoFactorAuthentication1785024000000 } from './migrations/1785024000000-two-factor-authentication';

describe('TwoFactorAuthentication1785024000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('adds bounded, hashed challenge storage and an enabled flag', async () => {
    await new TwoFactorAuthentication1785024000000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE');
    expect(sql).toContain('two_factor_challenge_token_hash VARCHAR(64)');
    expect(sql).toContain("CHECK (two_factor_challenge_purpose IN ('login', 'enable'))");
    expect(sql).toContain('CREATE UNIQUE INDEX uq_users_two_factor_challenge_token');
  });

  it('removes the challenge index and columns', async () => {
    await new TwoFactorAuthentication1785024000000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP INDEX IF EXISTS uq_users_two_factor_challenge_token');
    expect(sql).toContain('DROP COLUMN IF EXISTS two_factor_enabled');
  });
});
