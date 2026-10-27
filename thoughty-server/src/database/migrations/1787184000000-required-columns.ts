import type { MigrationInterface, QueryRunner } from 'typeorm';

/** A column the entities declare non-null, and what fills its nulls: the column's default, or a nearby time. */
const REQUIRED_COLUMNS: readonly { table: string; column: string; fill: string }[] = [
  { table: 'entries', column: 'index', fill: '1' },
  { table: 'entries', column: 'tags', fill: "'{}'" },
  { table: 'entries', column: 'format', fill: "'plain'" },
  { table: 'entries', column: 'visibility', fill: "'private'" },
  { table: 'entries', column: 'is_favorite', fill: 'false' },
  { table: 'entries', column: 'is_archived', fill: 'false' },
  { table: 'entries', column: 'is_pinned', fill: 'false' },
  { table: 'entries', column: 'created_at', fill: 'COALESCE(updated_at, date::timestamp)' },
  { table: 'entry_revisions', column: 'format', fill: "'plaintext'" },
  { table: 'entry_revisions', column: 'visibility', fill: "'private'" },
  { table: 'entry_revisions', column: 'created_at', fill: 'CURRENT_TIMESTAMP' },
  { table: 'diaries', column: 'icon', fill: "'📓'" },
  { table: 'diaries', column: 'visibility', fill: "'private'" },
  { table: 'diaries', column: 'is_default', fill: 'false' },
  { table: 'diaries', column: 'position', fill: '0' },
  { table: 'diaries', column: 'created_at', fill: 'COALESCE(updated_at, CURRENT_TIMESTAMP)' },
  { table: 'users', column: 'auth_provider', fill: "'local'" },
  { table: 'users', column: 'email_verified', fill: 'false' },
  { table: 'users', column: 'created_at', fill: 'COALESCE(updated_at, CURRENT_TIMESTAMP)' },
  { table: 'users', column: 'updated_at', fill: 'created_at' },
  { table: 'attachments', column: 'created_at', fill: 'CURRENT_TIMESTAMP' },
  { table: 'refresh_tokens', column: 'created_at', fill: 'CURRENT_TIMESTAMP' },
  { table: 'settings', column: 'updated_at', fill: 'CURRENT_TIMESTAMP' },
];

const TABLES = [...new Set(REQUIRED_COLUMNS.map(({ table }) => table))];

/**
 * The initial schema created these columns nullable while the entities declare them non-null (most
 * with a default), so a row written before the defaults existed, or outside the app, read as `null`
 * where the code expects a value. Each null takes the column's default (a missing `created_at` the
 * row's `updated_at` or entry date when there is one, `users.updated_at` its `created_at`), then the
 * column becomes `NOT NULL`, as does the generated `entries.search_vector`, which is never null. `diaries.icon` also gets the `'📓'` default the entity declares. The
 * tables are locked against writes meanwhile. `users.email` stays nullable: no value can be made up
 * for an account without one (see Needs Input in `TODO.md`).
 */
export class RequiredColumns1787184000000 implements MigrationInterface {
  name = 'RequiredColumns1787184000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`LOCK TABLE ${TABLES.join(', ')} IN SHARE ROW EXCLUSIVE MODE`);
    await queryRunner.query(`ALTER TABLE diaries ALTER COLUMN icon SET DEFAULT '📓'`);
    for (const { table, column, fill } of REQUIRED_COLUMNS) {
      await queryRunner.query(`UPDATE ${table} SET "${column}" = ${fill} WHERE "${column}" IS NULL`);
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN "${column}" SET NOT NULL`);
    }
    // Generated from title, text and tags, each read through COALESCE, so never null
    await queryRunner.query('ALTER TABLE entries ALTER COLUMN search_vector SET NOT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // The filled values stay: nothing records which rows were null.
    await queryRunner.query('ALTER TABLE entries ALTER COLUMN search_vector DROP NOT NULL');
    for (const { table, column } of [...REQUIRED_COLUMNS].reverse()) {
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN "${column}" DROP NOT NULL`);
    }
    await queryRunner.query('ALTER TABLE diaries ALTER COLUMN icon DROP DEFAULT');
  }
}
