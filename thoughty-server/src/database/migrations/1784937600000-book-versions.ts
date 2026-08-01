import type { MigrationInterface, QueryRunner } from 'typeorm';

export class BookVersions1784937600000 implements MigrationInterface {
  name = 'BookVersions1784937600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE book_versions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        diary_id INTEGER REFERENCES diaries(id) ON DELETE CASCADE,
        scope_key VARCHAR(32) NOT NULL,
        version_number INTEGER NOT NULL CHECK (version_number > 0),
        title VARCHAR(200) NOT NULL,
        author VARCHAR(200),
        format VARCHAR(8) NOT NULL CHECK (format IN ('pdf', 'epub', 'html', 'md')),
        filename VARCHAR(255) NOT NULL,
        content_type VARCHAR(100) NOT NULL,
        content BYTEA NOT NULL,
        manifest JSONB NOT NULL,
        chapter_count INTEGER NOT NULL CHECK (chapter_count >= 0),
        entry_count INTEGER NOT NULL CHECK (entry_count >= 0),
        added_entry_count INTEGER NOT NULL CHECK (added_entry_count >= 0),
        added_chapter_titles JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_book_versions_scope_version
          UNIQUE(user_id, scope_key, version_number)
      );

      CREATE INDEX idx_book_versions_user_scope_created
        ON book_versions(user_id, scope_key, created_at DESC);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS book_versions');
  }
}
