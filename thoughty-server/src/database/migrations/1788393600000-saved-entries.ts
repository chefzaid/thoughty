import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Saved feed entries: a private list of other writers' public entries, one row per reader and entry.
 * An entry leaves every list once the feed may no longer show it (made private or PIN-locked, archived,
 * moderated or moved to the recycle bin): a trigger deletes its rows then, so publishing it again later does
 * not bring it back. Rows go with the entry or the reader; an author's deleted account only hides
 * them (the feed's own rules) until the account is purged.
 */
export class SavedEntries1788393600000 implements MigrationInterface {
  name = 'SavedEntries1788393600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE saved_entries (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, entry_id)
      );
      CREATE INDEX idx_saved_entries_entry ON saved_entries(entry_id);

      CREATE FUNCTION entries_drop_unshown_saves() RETURNS trigger AS $$
      BEGIN
        DELETE FROM saved_entries WHERE entry_id = NEW.id;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_entries_drop_unshown_saves
        AFTER UPDATE OF visibility, is_locked, diary_locked, is_archived, moderation_status, deleted_at
        ON entries
        FOR EACH ROW
        WHEN (
          NEW.visibility <> 'public'
          OR NEW.is_archived
          OR NEW.moderation_status <> 'visible'
          OR NEW.deleted_at IS NOT NULL
        )
        EXECUTE FUNCTION entries_drop_unshown_saves();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_entries_drop_unshown_saves ON entries;
      DROP FUNCTION IF EXISTS entries_drop_unshown_saves();
      DROP TABLE IF EXISTS saved_entries;
    `);
  }
}
