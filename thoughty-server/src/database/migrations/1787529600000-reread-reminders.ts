import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reread reminders: the writer's own day (`reread_on`) on which an entry comes back in Highlights with
 * "You asked to reread this". One per entry, so it lives on the entry row; setting another date
 * replaces it, and "Done rereading" or removing it clears it. A sealed time capsule cannot have one,
 * which a check keeps. Highlights finds the reminders that are due through the partial index.
 */
export class RereadReminders1787529600000 implements MigrationInterface {
  name = 'RereadReminders1787529600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries
        ADD COLUMN reread_on DATE,
        ADD CONSTRAINT chk_entries_reread_open CHECK (reread_on IS NULL OR sealed_until IS NULL);

      CREATE INDEX idx_entries_user_reread_on
        ON entries(user_id, reread_on)
        WHERE reread_on IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_entries_user_reread_on;

      ALTER TABLE entries
        DROP CONSTRAINT IF EXISTS chk_entries_reread_open,
        DROP COLUMN IF EXISTS reread_on;
    `);
  }
}
