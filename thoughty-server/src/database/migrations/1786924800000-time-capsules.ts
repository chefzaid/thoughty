import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Time capsules: an entry sealed until a chosen local date and hour. While it is sealed, the entry row
 * keeps only its date, diary and flags (`sealed_until` is when it opens, and a sealed entry stays
 * private); its title, text, tags, mood and feelings wait in `time_capsules`, so no read path that
 * looks at entries can show them. Opening moves them back and clears the sealed copy, which a check
 * keeps in step with `opened_at`. The worker finds the capsules that are due through the partial index
 * on `open_at`, and Highlights finds those opened lately through the one on `opened_at`.
 */
export class TimeCapsules1786924800000 implements MigrationInterface {
  name = 'TimeCapsules1786924800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries
        ADD COLUMN sealed_until TIMESTAMPTZ,
        ADD CONSTRAINT chk_entries_sealed_private CHECK (sealed_until IS NULL OR visibility = 'private');

      CREATE TABLE time_capsules (
        id SERIAL PRIMARY KEY,
        entry_id INTEGER NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        opens_on DATE NOT NULL,
        open_hour SMALLINT NOT NULL,
        time_zone VARCHAR(64) NOT NULL,
        open_at TIMESTAMPTZ NOT NULL,
        sealed_title VARCHAR(200),
        sealed_content TEXT,
        sealed_tags TEXT[] NOT NULL DEFAULT '{}',
        sealed_mood SMALLINT,
        sealed_feelings TEXT[] NOT NULL DEFAULT '{}',
        opened_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_time_capsules_hour CHECK (open_hour BETWEEN 0 AND 23),
        CONSTRAINT chk_time_capsules_sealed_copy CHECK ((opened_at IS NULL) = (sealed_content IS NOT NULL))
      );

      CREATE INDEX idx_time_capsules_due
        ON time_capsules(open_at)
        WHERE opened_at IS NULL;

      CREATE INDEX idx_time_capsules_user_opened
        ON time_capsules(user_id, opened_at)
        WHERE opened_at IS NOT NULL;
    `);
  }

  /** Still-sealed capsules go back into their entries first, so rolling back loses no text. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE entries e
      SET title = tc.sealed_title,
          content = tc.sealed_content,
          tags = tc.sealed_tags,
          mood = tc.sealed_mood,
          feelings = tc.sealed_feelings
      FROM time_capsules tc
      WHERE tc.entry_id = e.id AND tc.opened_at IS NULL;

      DROP TABLE IF EXISTS time_capsules;

      ALTER TABLE entries
        DROP CONSTRAINT IF EXISTS chk_entries_sealed_private,
        DROP COLUMN IF EXISTS sealed_until;
    `);
  }
}
