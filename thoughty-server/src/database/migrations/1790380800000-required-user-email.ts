import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `users.email` becomes `NOT NULL`, as the `User` entity and every sign-up path already require. The
 * initial schema created it nullable, and a database from before the TypeORM migrations may hold
 * accounts without an address (NULL or blank). No real address can be made up for them, so each gets a
 * placeholder, `user-<id>@invalid` (`placeholderEmail` in `common/utils`), on the reserved `.invalid`
 * domain no mail reaches (RFC 6761): unique, as the id is, and in lower case, as
 * `chk_users_email_lowercase` asks. A placeholder was never proven, so the account's address is marked
 * unverified and any pending verification link is dropped. The writer is asked for a real address at
 * their next sign-in, and the app never sends mail to a placeholder (docs/operations.md, "Accounts
 * without an email address").
 *
 * `pending_email` holds the address a writer gave instead, until they open the link sent to it; only
 * then does it replace the placeholder. The table is locked against writes meanwhile, so no account
 * without an address can be added before the column is required.
 */
export class RequiredUserEmail1790380800000 implements MigrationInterface {
  name = 'RequiredUserEmail1790380800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    await queryRunner.query(`
      UPDATE users
         SET email = 'user-' || id || '@invalid',
             email_verified = false,
             email_verification_token = NULL,
             email_verification_token_expires = NULL
       WHERE email IS NULL OR btrim(email) = ''`);
    await queryRunner.query('ALTER TABLE users ALTER COLUMN email SET NOT NULL');
    await queryRunner.query('ALTER TABLE users ADD COLUMN pending_email VARCHAR(255)');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // A blank address was no address either: it comes back as NULL, like the others
    await queryRunner.query('ALTER TABLE users DROP COLUMN IF EXISTS pending_email');
    await queryRunner.query('ALTER TABLE users ALTER COLUMN email DROP NOT NULL');
    await queryRunner.query(`UPDATE users SET email = NULL WHERE email = 'user-' || id || '@invalid'`);
  }
}
