import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Entries, and the revisions that keep their earlier versions, get an optional mood check-in: a
 * level from 1 (very low) to 5 (very good) and a list of feeling words. Both columns are added
 * with constant defaults, so existing rows are not rewritten.
 */
export class EntryMood1786147200000 implements MigrationInterface {
  name = 'EntryMood1786147200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries
        ADD COLUMN mood SMALLINT,
        ADD COLUMN feelings TEXT[] NOT NULL DEFAULT '{}',
        ADD CONSTRAINT chk_entries_mood CHECK (mood BETWEEN 1 AND 5);

      ALTER TABLE entry_revisions
        ADD COLUMN mood SMALLINT,
        ADD COLUMN feelings TEXT[] NOT NULL DEFAULT '{}',
        ADD CONSTRAINT chk_entry_revisions_mood CHECK (mood BETWEEN 1 AND 5);

      CREATE INDEX idx_entries_user_mood_date
        ON entries(user_id, mood, date)
        WHERE mood IS NOT NULL;
    `);
  }

  /** Recorded moods and feelings are dropped with their columns. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_entries_user_mood_date;

      ALTER TABLE entry_revisions
        DROP CONSTRAINT IF EXISTS chk_entry_revisions_mood,
        DROP COLUMN IF EXISTS feelings,
        DROP COLUMN IF EXISTS mood;

      ALTER TABLE entries
        DROP CONSTRAINT IF EXISTS chk_entries_mood,
        DROP COLUMN IF EXISTS feelings,
        DROP COLUMN IF EXISTS mood;
    `);
  }
}
