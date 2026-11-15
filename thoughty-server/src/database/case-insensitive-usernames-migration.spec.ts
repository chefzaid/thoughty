import type { QueryRunner } from 'typeorm';
import { CaseInsensitiveUsernames1788134400000 } from './migrations/1788134400000-case-insensitive-usernames';

describe('CaseInsensitiveUsernames1788134400000', () => {
  const renamedUsername = CaseInsensitiveUsernames1788134400000.renamedUsername;
  const query = jest.fn();
  const queryRunner = { query } as unknown as QueryRunner;
  const statements = () => query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());

  beforeEach(() => jest.resetAllMocks());

  it('appends the account id, then a number, within the 100 characters of the column', () => {
    expect(renamedUsername('jane doe', 42, 1)).toBe('jane doe-42');
    expect(renamedUsername('jane doe', 42, 3)).toBe('jane doe-42-3');
    expect(renamedUsername('a'.repeat(100), 1234, 1)).toBe(`${'a'.repeat(95)}-1234`);
    const emoji = renamedUsername('😀'.repeat(100), 7, 2);
    expect(Array.from(emoji)).toHaveLength(100);
    expect(emoji.endsWith('😀-7-2')).toBe(true);
  });

  it('lower-cases addresses, renames each later username to the first free one and records it, then adds the index', async () => {
    query.mockImplementation(async (sql: string, parameters?: unknown[]) => {
      if (sql.includes('AS shared')) return [{ shared: 0 }];
      if (sql.includes('ROW_NUMBER()')) return [{ id: 9, username: 'jane doe' }];
      if (sql.includes('SELECT EXISTS')) return [{ taken: parameters?.[0] === 'jane doe-9' }];
      return [];
    });

    await new CaseInsensitiveUsernames1788134400000().up(queryRunner);

    const sql = statements();
    expect(sql[0]).toBe('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    expect(sql).toContain('UPDATE users SET email = lower(email) WHERE email <> lower(email)');
    expect(sql).toContain('ALTER TABLE users ADD CONSTRAINT chk_users_email_lowercase CHECK (email = lower(email))');
    expect(sql.find((statement) => statement.includes('ROW_NUMBER()'))).toContain(
      'PARTITION BY lower(username) ORDER BY (deleted_at IS NOT NULL), created_at, id',
    );
    expect(query.mock.calls.filter(([statement]) => String(statement).includes('SELECT EXISTS')).map(([, p]) => p))
      .toEqual([['jane doe-9'], ['jane doe-9-2']]);
    expect(query).toHaveBeenCalledWith('UPDATE users SET username = $1 WHERE id = $2', ['jane doe-9-2', 9]);
    expect(query).toHaveBeenCalledWith(
      'INSERT INTO username_renames (user_id, previous_username, username) VALUES ($1, $2, $3)',
      [9, 'jane doe', 'jane doe-9-2'],
    );
    expect(sql.slice(-2)).toEqual([
      'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key',
      'CREATE UNIQUE INDEX uq_users_username_lower ON users (lower(username))',
    ]);
  });

  it('adds the record table and the index straight away when no names repeat', async () => {
    query.mockImplementation(async (sql: string) => (sql.includes('AS shared') ? [{ shared: 0 }] : []));

    await new CaseInsensitiveUsernames1788134400000().up(queryRunner);

    expect(statements().some((statement) => statement.startsWith('CREATE TABLE username_renames'))).toBe(true);
    expect(statements().some((statement) => statement.startsWith('UPDATE users SET username'))).toBe(false);
  });

  it('refuses, naming their count, when addresses differ only in case', async () => {
    query.mockImplementation(async (sql: string) => (sql.includes('AS shared') ? [{ shared: 2 }] : []));

    await expect(new CaseInsensitiveUsernames1788134400000().up(queryRunner)).rejects.toThrow(
      /^2 e-mail address\(es\) belong to more than one account.*Accounts sharing an address/,
    );
    expect(statements()).toHaveLength(2);
  });

  it('drops the index, the record and the address check, and keeps the new names', async () => {
    await new CaseInsensitiveUsernames1788134400000().down(queryRunner);

    expect(statements()).toEqual([
      'DROP INDEX IF EXISTS uq_users_username_lower',
      'ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username)',
      'DROP TABLE IF EXISTS username_renames',
      'ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_email_lowercase',
    ]);
  });
});
