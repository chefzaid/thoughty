import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A third AI privacy mode for a diary, `ask`: an AI request about one of its entries or its text is sent only once
 * the writer has seen what it sends and agreed, and the journal-wide AI features (which read many entries at
 * once, with no single text to show) leave it out, as they leave out a diary with AI off.
 *
 * Each entry copies it (`entries.diary_ai_ask`) beside `diary_ai_off`, kept in step by the same two triggers, so a
 * query that feeds an AI prompt still tells from the entry row alone which entries it may read.
 */
export class DiaryAiAskMode1790121600000 implements MigrationInterface {
  name = 'DiaryAiAskMode1790121600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE diaries DROP CONSTRAINT chk_diaries_ai_mode;
      ALTER TABLE diaries ADD CONSTRAINT chk_diaries_ai_mode CHECK (ai_mode IN ('on', 'off', 'ask'));
      ALTER TABLE entries ADD COLUMN diary_ai_ask BOOLEAN NOT NULL DEFAULT false;

      CREATE OR REPLACE FUNCTION entries_copy_diary_ai_mode() RETURNS trigger AS $$
      DECLARE
        mode VARCHAR(10);
      BEGIN
        SELECT d.ai_mode INTO mode FROM diaries d WHERE d.id = NEW.diary_id;
        NEW.diary_ai_off := COALESCE(mode = 'off', false);
        NEW.diary_ai_ask := COALESCE(mode = 'ask', false);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER trg_entries_copy_diary_ai_mode ON entries;
      CREATE TRIGGER trg_entries_copy_diary_ai_mode
        BEFORE INSERT OR UPDATE OF diary_id, diary_ai_off, diary_ai_ask ON entries
        FOR EACH ROW
        EXECUTE FUNCTION entries_copy_diary_ai_mode();

      CREATE OR REPLACE FUNCTION diaries_ai_mode_entries() RETURNS trigger AS $$
      BEGIN
        UPDATE entries
          SET diary_ai_off = (NEW.ai_mode = 'off'), diary_ai_ask = (NEW.ai_mode = 'ask')
          WHERE diary_id = NEW.id;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // A diary that asks each time goes back to AI off, the closer of the two modes left
    await queryRunner.query(`
      UPDATE diaries SET ai_mode = 'off' WHERE ai_mode = 'ask';

      CREATE OR REPLACE FUNCTION diaries_ai_mode_entries() RETURNS trigger AS $$
      BEGIN
        UPDATE entries SET diary_ai_off = (NEW.ai_mode = 'off') WHERE diary_id = NEW.id;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER trg_entries_copy_diary_ai_mode ON entries;
      CREATE OR REPLACE FUNCTION entries_copy_diary_ai_mode() RETURNS trigger AS $$
      BEGIN
        NEW.diary_ai_off := COALESCE((SELECT d.ai_mode = 'off' FROM diaries d WHERE d.id = NEW.diary_id), false);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER trg_entries_copy_diary_ai_mode
        BEFORE INSERT OR UPDATE OF diary_id, diary_ai_off ON entries
        FOR EACH ROW
        EXECUTE FUNCTION entries_copy_diary_ai_mode();

      ALTER TABLE entries DROP COLUMN IF EXISTS diary_ai_ask;
      ALTER TABLE diaries DROP CONSTRAINT chk_diaries_ai_mode;
      ALTER TABLE diaries ADD CONSTRAINT chk_diaries_ai_mode CHECK (ai_mode IN ('on', 'off'));
    `);
  }
}
