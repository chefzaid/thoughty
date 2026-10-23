import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deleted entries go to a recycle bin for 30 days instead of being removed. Only entries
 * outside the bin need a unique import reference, so importing an export again after
 * deleting its entries brings them back as new entries.
 */
export class RecycleBin1785888000000 implements MigrationInterface {
  name = 'RecycleBin1785888000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries ADD COLUMN deleted_at TIMESTAMPTZ;

      CREATE INDEX idx_entries_user_deleted_at
        ON entries(user_id, deleted_at)
        WHERE deleted_at IS NOT NULL;

      DROP INDEX IF EXISTS idx_entries_user_import_ref;
      CREATE UNIQUE INDEX idx_entries_user_import_ref
        ON entries(user_id, import_ref)
        WHERE import_ref IS NOT NULL AND deleted_at IS NULL;
    `);
  }

  /** Entries still in the bin were deleted before the rollback, so they are removed for good. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM entries WHERE deleted_at IS NOT NULL;

      DROP INDEX IF EXISTS idx_entries_user_import_ref;
      CREATE UNIQUE INDEX idx_entries_user_import_ref
        ON entries(user_id, import_ref)
        WHERE import_ref IS NOT NULL;

      DROP INDEX IF EXISTS idx_entries_user_deleted_at;
      ALTER TABLE entries DROP COLUMN IF EXISTS deleted_at;
    `);
  }
}
