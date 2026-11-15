import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sign-ups wait here until the address is proven: a new account is created only from the emailed
 * link, so registration answers the same way whether or not the address already has an account.
 * One row per address. `token_hash` is the SHA-256 of the link's single-use token and comes with
 * the bcrypt hash of the chosen password; a row without them belongs to an address that already has
 * an account and only spaces out the "someone tried to sign up" notices sent to it. `sent_count`
 * caps the emails per address until the row expires, and expired rows are purged by the worker.
 */
export class SignUpRequests1788048000000 implements MigrationInterface {
  name = 'SignUpRequests1788048000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sign_up_requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        token_hash VARCHAR(64) UNIQUE,
        password_hash VARCHAR(255),
        username VARCHAR(50),
        sent_count SMALLINT NOT NULL DEFAULT 1,
        last_sent_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_sign_up_requests_email_lowercase CHECK (email = lower(email)),
        CONSTRAINT chk_sign_up_requests_token_and_password
          CHECK ((token_hash IS NULL) = (password_hash IS NULL)),
        CONSTRAINT chk_sign_up_requests_sent_count CHECK (sent_count >= 1)
      );
    `);
    await queryRunner.query(
      'CREATE INDEX idx_sign_up_requests_expires_at ON sign_up_requests (expires_at)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS sign_up_requests');
  }
}
