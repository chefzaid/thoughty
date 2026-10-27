import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Saved searches: named journal filter combinations, one name per writer whatever its case.
 * Deleting the diary a search is scoped to widens it to all diaries instead of removing it.
 */
export class SavedSearches1786320000000 implements MigrationInterface {
  name = 'SavedSearches1786320000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE saved_searches (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(80) NOT NULL,
        diary_id INTEGER REFERENCES diaries(id) ON DELETE SET NULL,
        filters JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_saved_searches_name CHECK (btrim(name) <> ''),
        CONSTRAINT chk_saved_searches_filters CHECK (jsonb_typeof(filters) = 'object')
      );

      CREATE UNIQUE INDEX uq_saved_searches_user_name ON saved_searches(user_id, lower(name));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS saved_searches;');
  }
}
