import type { MigrationInterface, QueryRunner } from 'typeorm';
import { linkMigrationEntryMentions } from './frozen/1786665600000-people-mentions';

/** Entries read per batch while linking existing entries to the people they mention. */
const BACKFILL_BATCH_SIZE = 500;

/**
 * People the writer mentions in entries (`@Marie`): `people` holds each person's display name,
 * `person_handles` the handles that mention them (one person per handle and writer, whatever its case),
 * and `entry_people` which entries mention whom. Existing entries are linked from their text, as the
 * app linked an entry each time it was saved when this was written, including those in the recycle bin;
 * the mention rules it applies are frozen in `frozen/1786665600000-people-mentions.ts`.
 */
export class People1786665600000 implements MigrationInterface {
  name = 'People1786665600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE people (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(80) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_people_name CHECK (btrim(name) <> '')
      );
      CREATE INDEX idx_people_user ON people(user_id);

      CREATE TABLE person_handles (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        handle VARCHAR(50) NOT NULL,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, handle),
        CONSTRAINT chk_person_handles_handle CHECK (handle <> '')
      );
      CREATE INDEX idx_person_handles_person ON person_handles(person_id);

      CREATE TABLE entry_people (
        entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        PRIMARY KEY (entry_id, person_id)
      );
      CREATE INDEX idx_entry_people_person ON entry_people(person_id, entry_id);
    `);

    let lastId = 0;
    for (;;) {
      const batch = (await queryRunner.query(
        `SELECT id, user_id AS "userId", content FROM entries WHERE id > $1 AND content LIKE '%@%' ORDER BY id LIMIT $2`,
        [lastId, BACKFILL_BATCH_SIZE],
      )) as Array<{ id: number; userId: number; content: string }>;
      if (batch.length === 0) {
        break;
      }
      lastId = batch.at(-1)!.id;
      const byWriter = new Map<number, typeof batch>();
      for (const entry of batch) {
        byWriter.set(entry.userId, [...(byWriter.get(entry.userId) ?? []), entry]);
      }
      for (const [userId, entries] of byWriter) {
        await linkMigrationEntryMentions(queryRunner, userId, entries);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS entry_people; DROP TABLE IF EXISTS person_handles; DROP TABLE IF EXISTS people;');
  }
}
