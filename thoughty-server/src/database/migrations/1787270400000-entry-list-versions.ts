import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The tables the journal list reads (`EntriesQueryService.getEntries`: the entries, their diary and
 * attachments, and the life era and person filters). A change to any of them changes a writer's list.
 */
const ENTRY_LIST_TABLES = ['entries', 'diaries', 'attachments', 'life_eras', 'entry_people'] as const;

/**
 * A version number per writer that every change to their journal list moves on, so the API's
 * per-replica list cache can tell a stale copy from a fresh one whichever replica, worker, service or
 * raw SQL statement made the change. A deferred row trigger on each list table bumps the writer's
 * version when the transaction commits: once per transaction (`changed_by` holds the transaction
 * that last bumped it), and after the transaction's other locks, so the version row is never held
 * while another lock is awaited. The version and the data it describes become visible in the same
 * commit. `entry_people` has no writer column, so its rows find theirs through the entry; when the
 * entry or the account goes in the same transaction, that entry's own trigger (or the account's
 * cascade) covers it and nothing is bumped for a writer who no longer exists.
 */
export class EntryListVersions1787270400000 implements MigrationInterface {
  name = 'EntryListVersions1787270400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE entry_list_versions (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        version BIGINT NOT NULL DEFAULT 1,
        changed_by XID8 NOT NULL
      );

      CREATE FUNCTION bump_entry_list_version(writer INTEGER) RETURNS void LANGUAGE sql AS $$
        INSERT INTO entry_list_versions AS v (user_id, changed_by)
        SELECT u.id, pg_current_xact_id() FROM users u WHERE u.id = writer
        ON CONFLICT (user_id) DO UPDATE
          SET version = v.version + 1, changed_by = EXCLUDED.changed_by
          WHERE v.changed_by <> EXCLUDED.changed_by
      $$;

      CREATE FUNCTION entry_list_changed() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_TABLE_NAME = 'entry_people' THEN
          IF TG_OP <> 'INSERT' THEN
            PERFORM bump_entry_list_version((SELECT user_id FROM entries WHERE id = OLD.entry_id));
          END IF;
          IF TG_OP <> 'DELETE' THEN
            PERFORM bump_entry_list_version((SELECT user_id FROM entries WHERE id = NEW.entry_id));
          END IF;
        ELSE
          IF TG_OP <> 'INSERT' THEN
            PERFORM bump_entry_list_version(OLD.user_id);
          END IF;
          IF TG_OP <> 'DELETE' THEN
            PERFORM bump_entry_list_version(NEW.user_id);
          END IF;
        END IF;
        RETURN NULL;
      END
      $$;
    `);
    for (const table of ENTRY_LIST_TABLES) {
      await queryRunner.query(`
        CREATE CONSTRAINT TRIGGER trg_${table}_entry_list_version
          AFTER INSERT OR UPDATE OR DELETE ON ${table}
          DEFERRABLE INITIALLY DEFERRED
          FOR EACH ROW EXECUTE FUNCTION entry_list_changed()
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...ENTRY_LIST_TABLES].reverse()) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_${table}_entry_list_version ON ${table}`);
    }
    await queryRunner.query(`
      DROP FUNCTION IF EXISTS entry_list_changed();
      DROP FUNCTION IF EXISTS bump_entry_list_version(INTEGER);
      DROP TABLE IF EXISTS entry_list_versions;
    `);
  }
}
