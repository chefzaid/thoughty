import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * When an entry was brought in by an import (a text file, JSON, Markdown, or an app such as Day One), so
 * **When you write** can leave out imported entries without a time of day: their `created_at` is the
 * import's moment, not when they were written. Entries an app import made already say so by their
 * `import_ref`, and their `created_at` is that import's moment, so they are marked from it; a file import
 * left no trace, so its entries stay unmarked.
 */
export class EntryImportedAt1790294400000 implements MigrationInterface {
  name = 'EntryImportedAt1790294400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries ADD COLUMN imported_at TIMESTAMPTZ;

      UPDATE entries SET imported_at = created_at WHERE import_ref IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE entries DROP COLUMN IF EXISTS imported_at;`);
  }
}
