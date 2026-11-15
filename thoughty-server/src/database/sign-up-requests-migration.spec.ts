import type { QueryRunner } from 'typeorm';
import { SignUpRequests1788048000000 } from './migrations/1788048000000-sign-up-requests';

describe('SignUpRequests1788048000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = (call: number) => (queryRunner.query as jest.Mock).mock.calls[call][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one hashed, expiring sign-up per lowercase address, with a password only beside a token', async () => {
    await new SignUpRequests1788048000000().up(queryRunner);

    const table = sql(0);
    expect(table).toContain('CREATE TABLE sign_up_requests');
    expect(table).toContain('email VARCHAR(255) NOT NULL UNIQUE');
    expect(table).toContain('token_hash VARCHAR(64) UNIQUE');
    expect(table).toContain('password_hash VARCHAR(255)');
    expect(table).toContain('username VARCHAR(50)');
    expect(table).toContain('sent_count SMALLINT NOT NULL DEFAULT 1');
    expect(table).toContain('expires_at TIMESTAMPTZ NOT NULL');
    expect(table).toContain('CHECK (email = lower(email))');
    expect(table).toContain('CHECK ((token_hash IS NULL) = (password_hash IS NULL))');
    expect(table).toContain('CHECK (sent_count >= 1)');
    expect(sql(1)).toBe(
      'CREATE INDEX idx_sign_up_requests_expires_at ON sign_up_requests (expires_at)',
    );
  });

  it('drops the table', async () => {
    await new SignUpRequests1788048000000().down(queryRunner);

    expect(sql(0)).toBe('DROP TABLE IF EXISTS sign_up_requests');
  });
});
