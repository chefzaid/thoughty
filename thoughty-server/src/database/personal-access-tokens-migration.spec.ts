import type { QueryRunner } from 'typeorm';
import { ACCESS_TOKEN_SCOPES, ACCOUNT_EVENT_KINDS } from './entities';
import { PersonalAccessTokens1788912000000 } from './migrations/1788912000000-personal-access-tokens';

describe('PersonalAccessTokens1788912000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = (call: number) => (queryRunner.query as jest.Mock).mock.calls[call][0] as string;
  const allowedKinds = (statement: string) =>
    (/CHECK \(kind IN \(([^)]*)\)\)/.exec(statement)?.[1] ?? '').match(/'[a-z_]+'/g)?.map((kind) => kind.slice(1, -1));

  beforeEach(() => jest.clearAllMocks());

  it('keeps each token as its hash, with its scopes, time zone and dates, gone with the account', async () => {
    await new PersonalAccessTokens1788912000000().up(queryRunner);

    const statement = sql(0);
    expect(statement).toContain('CREATE TABLE personal_access_tokens');
    expect(statement).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(statement).toContain('token_hash VARCHAR(64) NOT NULL');
    expect(statement).not.toMatch(/\btoken (VARCHAR|TEXT)/);
    expect(statement).toContain('CREATE UNIQUE INDEX uq_personal_access_tokens_token_hash ON personal_access_tokens(token_hash)');
    expect(statement).toContain('CREATE INDEX idx_personal_access_tokens_user ON personal_access_tokens(user_id)');
    const scopes = /scopes <@ ARRAY\[([^\]]*)\]/.exec(statement)?.[1].match(/'[a-z:]+'/g)?.map((scope) => scope.slice(1, -1));
    expect(scopes).toEqual([...ACCESS_TOKEN_SCOPES]);
  });

  it('lets the account activity record tokens made and revoked, exactly the kinds the entity knows', async () => {
    await new PersonalAccessTokens1788912000000().up(queryRunner);

    expect(sql(1)).toContain('DROP CONSTRAINT chk_account_events_kind');
    expect(allowedKinds(sql(1))).toEqual([...ACCOUNT_EVENT_KINDS]);
  });

  it('puts the earlier kinds back and drops the table', async () => {
    await new PersonalAccessTokens1788912000000().down(queryRunner);

    expect(sql(0)).toContain("DELETE FROM account_events WHERE kind IN ('access_token_created', 'access_token_revoked')");
    expect(allowedKinds(sql(0))).toEqual(ACCOUNT_EVENT_KINDS.filter((kind) => !kind.startsWith('access_token_')));
    expect(sql(1)).toBe('DROP TABLE IF EXISTS personal_access_tokens;');
  });
});
