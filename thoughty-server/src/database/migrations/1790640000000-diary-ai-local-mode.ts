import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A fourth AI privacy mode for a diary, `local`: its AI actions go from the writer's browser to a model server the
 * writer runs themselves (an OpenAI-compatible address such as Ollama's), so Thoughty's server never sends its text
 * to its own AI provider.
 *
 * For the server such a diary is one with AI off: each entry's `diary_ai_off` is set for it too, so every query that
 * leaves AI-off entries out of a prompt (and every check written for AI off) leaves it out with no change. Its
 * entries also copy `diary_ai_local`, kept in step by the same two triggers, only so a refusal can say why
 * (`DIARY_AI_LOCAL` rather than `DIARY_AI_OFF`).
 */
export class DiaryAiLocalMode1790640000000 implements MigrationInterface {
  name = 'DiaryAiLocalMode1790640000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE diaries DROP CONSTRAINT chk_diaries_ai_mode;
      ALTER TABLE diaries ADD CONSTRAINT chk_diaries_ai_mode CHECK (ai_mode IN ('on', 'off', 'ask', 'local'));
      ALTER TABLE entries ADD COLUMN diary_ai_local BOOLEAN NOT NULL DEFAULT false;

      CREATE OR REPLACE FUNCTION entries_copy_diary_ai_mode() RETURNS trigger AS $$
      DECLARE
        mode VARCHAR(10);
      BEGIN
        SELECT d.ai_mode INTO mode FROM diaries d WHERE d.id = NEW.diary_id;
        NEW.diary_ai_off := COALESCE(mode IN ('off', 'local'), false);
        NEW.diary_ai_ask := COALESCE(mode = 'ask', false);
        NEW.diary_ai_local := COALESCE(mode = 'local', false);
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER trg_entries_copy_diary_ai_mode ON entries;
      CREATE TRIGGER trg_entries_copy_diary_ai_mode
        BEFORE INSERT OR UPDATE OF diary_id, diary_ai_off, diary_ai_ask, diary_ai_local ON entries
        FOR EACH ROW
        EXECUTE FUNCTION entries_copy_diary_ai_mode();

      CREATE OR REPLACE FUNCTION diaries_ai_mode_entries() RETURNS trigger AS $$
      BEGIN
        UPDATE entries
          SET diary_ai_off = (NEW.ai_mode IN ('off', 'local')),
            diary_ai_ask = (NEW.ai_mode = 'ask'),
            diary_ai_local = (NEW.ai_mode = 'local')
          WHERE diary_id = NEW.id;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // A diary on the writer's own model goes back to AI off, which its entries already are for the server
    await queryRunner.query(`
      UPDATE diaries SET ai_mode = 'off' WHERE ai_mode = 'local';

      CREATE OR REPLACE FUNCTION diaries_ai_mode_entries() RETURNS trigger AS $$
      BEGIN
        UPDATE entries
          SET diary_ai_off = (NEW.ai_mode = 'off'), diary_ai_ask = (NEW.ai_mode = 'ask')
          WHERE diary_id = NEW.id;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER trg_entries_copy_diary_ai_mode ON entries;
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
      CREATE TRIGGER trg_entries_copy_diary_ai_mode
        BEFORE INSERT OR UPDATE OF diary_id, diary_ai_off, diary_ai_ask ON entries
        FOR EACH ROW
        EXECUTE FUNCTION entries_copy_diary_ai_mode();

      ALTER TABLE entries DROP COLUMN IF EXISTS diary_ai_local;
      ALTER TABLE diaries DROP CONSTRAINT chk_diaries_ai_mode;
      ALTER TABLE diaries ADD CONSTRAINT chk_diaries_ai_mode CHECK (ai_mode IN ('on', 'off', 'ask'));
    `);
  }
}
