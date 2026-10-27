import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deleting a saved search now deletes the book versions built from it. This removes the versions
 * left behind by saved searches deleted before that, which no screen could list, download or
 * delete any more.
 */
export class OrphanedSavedSearchBookVersions1786579200000 implements MigrationInterface {
  name = 'OrphanedSavedSearchBookVersions1786579200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM book_versions version
      WHERE version.scope_key LIKE 'search:%'
        AND NOT EXISTS (
          SELECT 1 FROM saved_searches saved
          WHERE saved.user_id = version.user_id
            AND 'search:' || saved.id = version.scope_key
        );
    `);
  }

  async down(): Promise<void> {
    // The deleted versions cannot come back, and the rule that removes them has no schema to undo.
  }
}
