import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The AI privacy mode of a diary: `on` (every diary so far, the AI features read it as before) or `off`
 * (no AI feature reads its entries, nor their tags, attachments or memoir answers).
 *
 * As with the PIN lock, every query has to tell from the entry row alone, so `entries.diary_ai_off`
 * copies its diary's mode: a trigger sets it whenever an entry is written or moves to another diary, and
 * another follows a diary's mode to its entries, so no path that creates, imports or moves an entry can
 * leave it out of step.
 */
export class DiaryAiMode1790035200000 implements MigrationInterface {
  name = 'DiaryAiMode1790035200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE diaries
        ADD COLUMN ai_mode VARCHAR(10) NOT NULL DEFAULT 'on',
        ADD CONSTRAINT chk_diaries_ai_mode CHECK (ai_mode IN ('on', 'off'));
      ALTER TABLE entries ADD COLUMN diary_ai_off BOOLEAN NOT NULL DEFAULT false;

      CREATE FUNCTION entries_copy_diary_ai_mode() RETURNS trigger AS $$
      BEGIN
        NEW.diary_ai_off := COALESCE((SELECT d.ai_mode = 'off' FROM diaries d WHERE d.id = NEW.diary_id), false);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_entries_copy_diary_ai_mode
        BEFORE INSERT OR UPDATE OF diary_id, diary_ai_off ON entries
        FOR EACH ROW
        EXECUTE FUNCTION entries_copy_diary_ai_mode();

      CREATE FUNCTION diaries_ai_mode_entries() RETURNS trigger AS $$
      BEGIN
        UPDATE entries SET diary_ai_off = (NEW.ai_mode = 'off') WHERE diary_id = NEW.id;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_diaries_ai_mode_entries
        AFTER UPDATE OF ai_mode ON diaries
        FOR EACH ROW
        WHEN (OLD.ai_mode IS DISTINCT FROM NEW.ai_mode)
        EXECUTE FUNCTION diaries_ai_mode_entries();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_diaries_ai_mode_entries ON diaries;
      DROP FUNCTION IF EXISTS diaries_ai_mode_entries();
      DROP TRIGGER IF EXISTS trg_entries_copy_diary_ai_mode ON entries;
      DROP FUNCTION IF EXISTS entries_copy_diary_ai_mode();
      ALTER TABLE entries DROP COLUMN IF EXISTS diary_ai_off;
      ALTER TABLE diaries DROP CONSTRAINT IF EXISTS chk_diaries_ai_mode, DROP COLUMN IF EXISTS ai_mode;
    `);
  }
}
