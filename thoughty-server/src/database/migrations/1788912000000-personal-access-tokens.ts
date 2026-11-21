import type { MigrationInterface, QueryRunner } from 'typeorm';

const KINDS_BEFORE = [
  'sign_in', 'sign_in_refused', 'sign_out', 'sessions_revoked', 'password_changed', 'password_reset',
  'two_factor_enabled', 'two_factor_disabled', 'pin_set', 'pin_changed', 'pin_reset', 'pin_removed',
  'data_downloaded', 'journal_exported', 'share_link_created', 'share_link_revoked',
];
const KINDS_AFTER = [...KINDS_BEFORE, 'access_token_created', 'access_token_revoked'];

const kindCheck = (kinds: string[]) =>
  `ALTER TABLE account_events ADD CONSTRAINT chk_account_events_kind CHECK (kind IN (${kinds.map((kind) => `'${kind}'`).join(', ')}));`;

/**
 * Personal access tokens for the public API (`/api/v1`): a writer's named keys for scripts, iOS Shortcuts
 * or Zapier, each limited to its scopes and kept only as the SHA-256 of the token, with the time zone of
 * the browser that made it, an optional expiry and when it was last used. Rows go with the account. Making
 * and revoking one is recorded in the account activity.
 */
export class PersonalAccessTokens1788912000000 implements MigrationInterface {
  name = 'PersonalAccessTokens1788912000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE personal_access_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(60) NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        token_hint VARCHAR(12) NOT NULL,
        scopes TEXT[] NOT NULL,
        time_zone VARCHAR(64) NOT NULL,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_personal_access_tokens_scopes CHECK (
          cardinality(scopes) > 0 AND scopes <@ ARRAY['entries:read', 'entries:write']::TEXT[]
        )
      );
      CREATE UNIQUE INDEX uq_personal_access_tokens_token_hash ON personal_access_tokens(token_hash);
      CREATE INDEX idx_personal_access_tokens_user ON personal_access_tokens(user_id);
    `);
    await queryRunner.query(`
      ALTER TABLE account_events DROP CONSTRAINT chk_account_events_kind;
      ${kindCheck(KINDS_AFTER)}
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM account_events WHERE kind IN ('access_token_created', 'access_token_revoked');
      ALTER TABLE account_events DROP CONSTRAINT chk_account_events_kind;
      ${kindCheck(KINDS_BEFORE)}
    `);
    await queryRunner.query('DROP TABLE IF EXISTS personal_access_tokens;');
  }
}
