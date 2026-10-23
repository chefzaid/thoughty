import type { QueryRunner } from 'typeorm';
import { HashedRefreshTokens1786233600000 } from './migrations/1786233600000-hashed-refresh-tokens';

describe('HashedRefreshTokens1786233600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('hashes stored refresh tokens in place with the built-in sha256 function', async () => {
    await new HashedRefreshTokens1786233600000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('RENAME COLUMN token TO token_hash');
    expect(sql).toContain("encode(sha256(convert_to(token_hash, 'UTF8')), 'hex')");
    expect(sql).not.toContain('pgcrypto');
    expect(sql).toContain('ALTER COLUMN token_hash TYPE VARCHAR(64)');
    expect(sql).toContain('CREATE UNIQUE INDEX uq_refresh_tokens_token_hash');
    expect(sql.indexOf('DELETE FROM refresh_tokens')).toBeLessThan(
      sql.indexOf('CREATE UNIQUE INDEX'),
    );
  });

  it('drops the hashes, which cannot be reversed, when rolled back', async () => {
    await new HashedRefreshTokens1786233600000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP INDEX IF EXISTS uq_refresh_tokens_token_hash');
    expect(sql).toContain('DELETE FROM refresh_tokens');
    expect(sql).toContain('RENAME COLUMN token_hash TO token');
  });
});
