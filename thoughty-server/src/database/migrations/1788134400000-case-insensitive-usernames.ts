import type { MigrationInterface, QueryRunner } from 'typeorm';

/** `users.username` is VARCHAR(100), counted in characters. */
const USERNAME_MAX_LENGTH = 100;

interface DuplicateUsername {
  id: number;
  username: string;
}

/**
 * Usernames and addresses become unique ignoring case, as sign-in already matches them
 * (`LOWER(username)`, `LOWER(email)`): with `Jane Doe` and `jane doe` both taken, signing in as
 * either found whichever row came first.
 *
 * Addresses are stored in lower case from now on (`chk_users_email_lowercase`), so their unique key
 * ignores case too. Two accounts whose addresses differ only in case cannot be told apart by an
 * address, and which of them owns it is a person's call, so the migration then refuses with their
 * count and changes nothing (docs/operations.md, "Accounts sharing an address").
 *
 * Usernames that differ only in case are resolved, so a deploy never stops on them: per name, a live
 * account goes before a deleted one, then the oldest (by `created_at`, then id) keeps its username
 * intact, and each later one becomes `<username>-<id>` (cut by whole characters to fit the column,
 * then `-2`, `-3`… should that be taken too). Each rename is recorded in `username_renames`, so the
 * writers can be told. Sign-in by address is unchanged. The table is locked against writes meanwhile,
 * so no duplicate can slip in before the index exists.
 */
export class CaseInsensitiveUsernames1788134400000 implements MigrationInterface {
  name = 'CaseInsensitiveUsernames1788134400000';

  /**
   * `Jane Doe-42` for account 42, then `Jane Doe-42-2`… A static method, as TypeORM would load any
   * other export of this file as a migration.
   */
  static renamedUsername(username: string, id: number, attempt: number): string {
    const suffix = attempt === 1 ? `-${id}` : `-${id}-${attempt}`;
    return Array.from(username).slice(0, USERNAME_MAX_LENGTH - suffix.length).join('') + suffix;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    await this.lowerCaseEmails(queryRunner);

    await queryRunner.query(`
      CREATE TABLE username_renames (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        previous_username VARCHAR(100) NOT NULL,
        username VARCHAR(100) NOT NULL,
        renamed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);
    await queryRunner.query('CREATE INDEX idx_username_renames_user_id ON username_renames (user_id)');

    const duplicates: DuplicateUsername[] = await queryRunner.query(`
      SELECT id, username FROM (
        SELECT id, username,
               ROW_NUMBER() OVER (
                 PARTITION BY lower(username) ORDER BY (deleted_at IS NOT NULL), created_at, id
               ) AS rank
          FROM users
      ) ranked
       WHERE rank > 1
       ORDER BY lower(username), rank`);
    for (const duplicate of duplicates) {
      const username = await this.freeUsername(queryRunner, duplicate);
      await queryRunner.query('UPDATE users SET username = $1 WHERE id = $2', [username, duplicate.id]);
      await queryRunner.query(
        'INSERT INTO username_renames (user_id, previous_username, username) VALUES ($1, $2, $3)',
        [duplicate.id, duplicate.username, username],
      );
    }

    await queryRunner.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key');
    await queryRunner.query('CREATE UNIQUE INDEX uq_users_username_lower ON users (lower(username))');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Renamed accounts keep their new names and addresses stay in lower case.
    await queryRunner.query('DROP INDEX IF EXISTS uq_users_username_lower');
    await queryRunner.query('ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username)');
    await queryRunner.query('DROP TABLE IF EXISTS username_renames');
    await queryRunner.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_email_lowercase');
  }

  /** Lower-cases every address, unless two accounts share one ignoring case. */
  private async lowerCaseEmails(queryRunner: QueryRunner): Promise<void> {
    const [{ shared }] = await queryRunner.query(`
      SELECT count(*)::int AS shared FROM (
        SELECT 1 FROM users WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1
      ) duplicates`);
    if (shared > 0) {
      throw new Error(
        `${shared} e-mail address(es) belong to more than one account when compared ignoring case. ` +
          'Decide which account keeps each address and change the others before migrating ' +
          '(docs/operations.md, "Accounts sharing an address"): ' +
          'SELECT lower(email), array_agg(id ORDER BY id) FROM users GROUP BY lower(email) HAVING count(*) > 1',
      );
    }
    await queryRunner.query('UPDATE users SET email = lower(email) WHERE email <> lower(email)');
    await queryRunner.query(
      'ALTER TABLE users ADD CONSTRAINT chk_users_email_lowercase CHECK (email = lower(email))',
    );
  }

  /** The first renamed username no account has in any case, compared as the index compares. */
  private async freeUsername(queryRunner: QueryRunner, { id, username }: DuplicateUsername): Promise<string> {
    for (let attempt = 1; ; attempt += 1) {
      const candidate = CaseInsensitiveUsernames1788134400000.renamedUsername(username, id, attempt);
      const [{ taken }] = await queryRunner.query(
        'SELECT EXISTS (SELECT 1 FROM users WHERE lower(username) = lower($1)) AS taken',
        [candidate],
      );
      if (!taken) return candidate;
    }
  }
}
