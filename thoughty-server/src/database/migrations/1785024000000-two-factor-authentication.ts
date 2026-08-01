import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TwoFactorAuthentication1785024000000 implements MigrationInterface {
  name = 'TwoFactorAuthentication1785024000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        ADD COLUMN two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN two_factor_challenge_token_hash VARCHAR(64),
        ADD COLUMN two_factor_challenge_code_hash VARCHAR(64),
        ADD COLUMN two_factor_challenge_purpose VARCHAR(16)
          CHECK (two_factor_challenge_purpose IN ('login', 'enable')),
        ADD COLUMN two_factor_challenge_expires TIMESTAMP;

      CREATE UNIQUE INDEX uq_users_two_factor_challenge_token
        ON users(two_factor_challenge_token_hash)
        WHERE two_factor_challenge_token_hash IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_users_two_factor_challenge_token;
      ALTER TABLE users
        DROP COLUMN IF EXISTS two_factor_challenge_expires,
        DROP COLUMN IF EXISTS two_factor_challenge_purpose,
        DROP COLUMN IF EXISTS two_factor_challenge_code_hash,
        DROP COLUMN IF EXISTS two_factor_challenge_token_hash,
        DROP COLUMN IF EXISTS two_factor_enabled;
    `);
  }
}
