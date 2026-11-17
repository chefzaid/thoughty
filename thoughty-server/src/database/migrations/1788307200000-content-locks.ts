import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The PIN lock: one 4-digit PIN per writer (`content_pins`, bcrypt-hashed, with the wrong tries and
 * the lockout they earn), the unlocks it gives (`content_unlocks`, a token's SHA-256 and a sliding
 * expiry), and a lock flag on diaries and entries.
 *
 * An entry is locked when it or its diary is. So that every query can tell from the entry row alone,
 * `entries.diary_locked` copies its diary's flag: a trigger sets it whenever an entry is written or
 * moves to another diary, and another follows a diary's flag to its entries, so no path that creates,
 * imports or moves an entry can leave it out of step. The same trigger keeps a locked entry private, so
 * it never reaches the public feed. It is an access gate, not encryption: the text stays as it was.
 */
export class ContentLocks1788307200000 implements MigrationInterface {
  name = 'ContentLocks1788307200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE content_pins (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        pin_hash VARCHAR(100) NOT NULL,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        blocked_until TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_content_pins_failed_attempts CHECK (failed_attempts >= 0)
      );

      CREATE TABLE content_unlocks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_content_unlocks_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$')
      );
      CREATE UNIQUE INDEX uq_content_unlocks_token_hash ON content_unlocks(token_hash);
      CREATE INDEX idx_content_unlocks_user ON content_unlocks(user_id);

      ALTER TABLE diaries ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE entries
        ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN diary_locked BOOLEAN NOT NULL DEFAULT false;

      CREATE FUNCTION entries_copy_diary_lock() RETURNS trigger AS $$
      BEGIN
        NEW.diary_locked := COALESCE((SELECT d.is_locked FROM diaries d WHERE d.id = NEW.diary_id), false);
        IF NEW.is_locked OR NEW.diary_locked THEN
          NEW.visibility := 'private';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_entries_copy_diary_lock
        BEFORE INSERT OR UPDATE OF diary_id, diary_locked, is_locked, visibility ON entries
        FOR EACH ROW
        EXECUTE FUNCTION entries_copy_diary_lock();

      CREATE FUNCTION diaries_lock_entries() RETURNS trigger AS $$
      BEGIN
        UPDATE entries SET diary_locked = NEW.is_locked WHERE diary_id = NEW.id;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_diaries_lock_entries
        AFTER UPDATE OF is_locked ON diaries
        FOR EACH ROW
        WHEN (OLD.is_locked IS DISTINCT FROM NEW.is_locked)
        EXECUTE FUNCTION diaries_lock_entries();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_diaries_lock_entries ON diaries;
      DROP FUNCTION IF EXISTS diaries_lock_entries();
      DROP TRIGGER IF EXISTS trg_entries_copy_diary_lock ON entries;
      DROP FUNCTION IF EXISTS entries_copy_diary_lock();
      ALTER TABLE entries DROP COLUMN IF EXISTS diary_locked, DROP COLUMN IF EXISTS is_locked;
      ALTER TABLE diaries DROP COLUMN IF EXISTS is_locked;
      DROP TABLE IF EXISTS content_unlocks;
      DROP TABLE IF EXISTS content_pins;
    `);
  }
}
