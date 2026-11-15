import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Composer drafts: the new entry the writer is still writing, saved as they type so it continues on
 * another device. One row per writer, keyed by the writer, gone with their account. The fields keep the
 * entry's limits, and `revision` counts the saves so a device behind it cannot overwrite newer text.
 */
export class ComposerDrafts1787875200000 implements MigrationInterface {
  name = 'ComposerDrafts1787875200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE composer_drafts (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200),
        content TEXT NOT NULL,
        tags TEXT[] NOT NULL DEFAULT '{}',
        format VARCHAR(20) NOT NULL DEFAULT 'plain',
        mood SMALLINT,
        feelings TEXT[] NOT NULL DEFAULT '{}',
        revision INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_composer_drafts_content_length CHECK (char_length(content) <= 50000),
        CONSTRAINT chk_composer_drafts_format CHECK (format IN ('plain', 'markdown')),
        CONSTRAINT chk_composer_drafts_mood CHECK (mood IS NULL OR mood BETWEEN 1 AND 5),
        CONSTRAINT chk_composer_drafts_revision CHECK (revision >= 1)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS composer_drafts');
  }
}
