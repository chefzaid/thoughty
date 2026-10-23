import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refresh tokens are stored as SHA-256 hashes instead of plain text. Existing rows are hashed in
 * place with PostgreSQL's built-in `sha256()` (no pgcrypto needed), so the sessions they back stay
 * valid: the server hashes a presented token the same way (hex of SHA-256 over its UTF-8 bytes).
 * Duplicate tokens, which could exist because older tokens carried no unique id, are collapsed
 * before the unique index is built.
 */
export class HashedRefreshTokens1786233600000 implements MigrationInterface {
  name = 'HashedRefreshTokens1786233600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM refresh_tokens AS duplicate
        USING refresh_tokens AS kept
        WHERE duplicate.token = kept.token AND duplicate.id < kept.id;

      ALTER TABLE refresh_tokens RENAME COLUMN token TO token_hash;
      UPDATE refresh_tokens SET token_hash = encode(sha256(convert_to(token_hash, 'UTF8')), 'hex');
      ALTER TABLE refresh_tokens ALTER COLUMN token_hash TYPE VARCHAR(64);

      CREATE UNIQUE INDEX uq_refresh_tokens_token_hash ON refresh_tokens(token_hash);
    `);
  }

  /** Hashes cannot be turned back into tokens, so rolling back signs every session out. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_refresh_tokens_token_hash;
      DELETE FROM refresh_tokens;
      ALTER TABLE refresh_tokens ALTER COLUMN token_hash TYPE VARCHAR(255);
      ALTER TABLE refresh_tokens RENAME COLUMN token_hash TO token;
    `);
  }
}
