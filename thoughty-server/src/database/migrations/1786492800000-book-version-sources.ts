import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Book versions record where their entries came from: the journal (the versions made so far),
 * a saved search or entries picked by hand, so the next version is generated from the same place.
 */
export class BookVersionSources1786492800000 implements MigrationInterface {
  name = 'BookVersionSources1786492800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE book_versions
        ADD COLUMN source JSONB NOT NULL DEFAULT '{"kind":"journal"}'::jsonb,
        ADD CONSTRAINT chk_book_versions_source
          CHECK (source->>'kind' IN ('journal', 'savedSearch', 'entries'));
    `);
  }

  /** The versions keep their files; only the record of their source goes. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE book_versions
        DROP CONSTRAINT IF EXISTS chk_book_versions_source,
        DROP COLUMN IF EXISTS source;
    `);
  }
}
