import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Account activity: one row per sign-in, refused sign-in, sign-out and security change of an account
 * (password, two-factor, PIN lock, data downloads and exports, private share links), with the browser
 * and system names read from the user agent and never an IP address. Listed to the writer in Profile ›
 * Privacy for a year, then removed by the background worker; rows go with the account.
 */
export class AccountEvents1788739200000 implements MigrationInterface {
  name = 'AccountEvents1788739200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE account_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(32) NOT NULL,
        browser VARCHAR(40),
        system VARCHAR(40),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_account_events_kind CHECK (kind IN (
          'sign_in', 'sign_in_refused', 'sign_out', 'sessions_revoked', 'password_changed', 'password_reset',
          'two_factor_enabled', 'two_factor_disabled', 'pin_set', 'pin_changed', 'pin_reset', 'pin_removed',
          'data_downloaded', 'journal_exported', 'share_link_created', 'share_link_revoked'
        ))
      );
      CREATE INDEX idx_account_events_user_created ON account_events(user_id, created_at);
      CREATE INDEX idx_account_events_created ON account_events(created_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS account_events;');
  }
}
