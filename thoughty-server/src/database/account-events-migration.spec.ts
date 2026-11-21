import type { QueryRunner } from 'typeorm';
import { ACCOUNT_EVENT_KINDS } from './entities';
import { AccountEvents1788739200000 } from './migrations/1788739200000-account-events';

describe('AccountEvents1788739200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('keeps each event with its kind, browser and system, gone with the account and found by date', async () => {
    await new AccountEvents1788739200000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain('CREATE TABLE account_events');
    expect(statement).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(statement).toContain('browser VARCHAR(40)');
    expect(statement).toContain('system VARCHAR(40)');
    expect(statement).not.toMatch(/\bip\b|address/i);
    expect(statement).toContain(
      'CREATE INDEX idx_account_events_user_created ON account_events(user_id, created_at)',
    );
    expect(statement).toContain('CREATE INDEX idx_account_events_created ON account_events(created_at)');
  });

  it('allows exactly the kinds the entity knew then (access tokens came with PersonalAccessTokens1788912000000)', async () => {
    await new AccountEvents1788739200000().up(queryRunner);

    const allowed = /CHECK \(kind IN \(([^)]*)\)\)/.exec(sql())?.[1] ?? '';
    expect(allowed.match(/'[a-z_]+'/g)?.map((kind) => kind.slice(1, -1))).toEqual(
      ACCOUNT_EVENT_KINDS.filter((kind) => !kind.startsWith('access_token_')),
    );
  });

  it('drops the table', async () => {
    await new AccountEvents1788739200000().down(queryRunner);

    expect(sql()).toBe('DROP TABLE IF EXISTS account_events;');
  });
});
