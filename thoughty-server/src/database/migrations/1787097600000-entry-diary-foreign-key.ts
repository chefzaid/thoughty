import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `entries.diary_id` gets the foreign key the `Entry` entity declares (`ON DELETE SET NULL`). The
 * initial schema skipped it whenever `entries` already existed, so an entry could point at a diary
 * that is gone or, written outside the app, at another writer's diary. Such an entry moves to its
 * writer's default diary, as deleting a diary moves its entries, or loses its diary when the writer
 * has no default; nothing else about it changes. A foreign key an older database may already have
 * on the column is replaced, so there is exactly one, under a known name.
 */
export class EntryDiaryForeignKey1787097600000 implements MigrationInterface {
  name = 'EntryDiaryForeignKey1787097600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE existing record;
      BEGIN
        FOR existing IN
          SELECT conname FROM pg_constraint
           WHERE conrelid = 'entries'::regclass AND contype = 'f' AND confrelid = 'diaries'::regclass
        LOOP
          EXECUTE format('ALTER TABLE entries DROP CONSTRAINT %I', existing.conname);
        END LOOP;
      END $$;

      UPDATE entries e
         SET diary_id = (SELECT d.id FROM diaries d WHERE d.user_id = e.user_id AND d.is_default ORDER BY d.id LIMIT 1)
       WHERE e.diary_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM diaries d WHERE d.id = e.diary_id AND d.user_id = e.user_id);

      ALTER TABLE entries
        ADD CONSTRAINT fk_entries_diary FOREIGN KEY (diary_id) REFERENCES diaries(id) ON DELETE SET NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Entries moved to the default diary stay there: nothing records where they pointed before.
    await queryRunner.query('ALTER TABLE entries DROP CONSTRAINT IF EXISTS fk_entries_diary');
  }
}
