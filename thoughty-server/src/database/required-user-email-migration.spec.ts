import type { QueryRunner } from 'typeorm';
import { RequiredUserEmail1790380800000 } from './migrations/1790380800000-required-user-email';

describe('RequiredUserEmail1790380800000', () => {
  const query = jest.fn();
  const queryRunner = { query } as unknown as QueryRunner;
  const statements = () => query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());

  beforeEach(() => jest.resetAllMocks());

  it('gives each account without an address its placeholder, unverified, then requires the column', async () => {
    await new RequiredUserEmail1790380800000().up(queryRunner);

    expect(statements()).toEqual([
      'LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE',
      "UPDATE users SET email = 'user-' || id || '@invalid', email_verified = false, " +
        'email_verification_token = NULL, email_verification_token_expires = NULL ' +
        "WHERE email IS NULL OR btrim(email) = ''",
      'ALTER TABLE users ALTER COLUMN email SET NOT NULL',
      'ALTER TABLE users ADD COLUMN pending_email VARCHAR(255)',
    ]);
  });

  it('drops the waiting address and the requirement, and turns placeholders back into NULL', async () => {
    await new RequiredUserEmail1790380800000().down(queryRunner);

    expect(statements()).toEqual([
      'ALTER TABLE users DROP COLUMN IF EXISTS pending_email',
      'ALTER TABLE users ALTER COLUMN email DROP NOT NULL',
      "UPDATE users SET email = NULL WHERE email = 'user-' || id || '@invalid'",
    ]);
  });
});
