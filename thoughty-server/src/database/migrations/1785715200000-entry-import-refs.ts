import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Remembers which source entry an imported entry came from, so running an import again skips it. */
export class EntryImportRefs1785715200000 implements MigrationInterface {
  name = 'EntryImportRefs1785715200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries ADD COLUMN import_ref VARCHAR(120);

      CREATE UNIQUE INDEX idx_entries_user_import_ref
        ON entries(user_id, import_ref)
        WHERE import_ref IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_entries_user_import_ref;
      ALTER TABLE entries DROP COLUMN IF EXISTS import_ref;
    `);
  }
}
