import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A birthday or an anniversary on a person: `date_kind` (`birthday` or `anniversary`), the month and day it
 * comes back on each year, and the year when the writer knows it. All three of kind, month and day are set or
 * none is; the year only with them. The checks refuse a day the month never has (31 April, 30 February) and
 * 29 February in a year that had none, so a date read back is always a real one. Highlights finds the
 * writer's people of the day through `idx_people_user_date`.
 */
export class PersonDates1787702400000 implements MigrationInterface {
  name = 'PersonDates1787702400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE people
        ADD COLUMN date_kind VARCHAR(16),
        ADD COLUMN date_month SMALLINT,
        ADD COLUMN date_day SMALLINT,
        ADD COLUMN date_year SMALLINT,
        ADD CONSTRAINT chk_people_date_kind CHECK (date_kind IN ('birthday', 'anniversary')),
        ADD CONSTRAINT chk_people_date_complete CHECK (
          (date_kind IS NULL) = (date_month IS NULL)
          AND (date_month IS NULL) = (date_day IS NULL)
          AND (date_year IS NULL OR date_month IS NOT NULL)
        ),
        ADD CONSTRAINT chk_people_date_day CHECK (
          date_month BETWEEN 1 AND 12
          AND date_day BETWEEN 1 AND (CASE WHEN date_month = 2 THEN 29 WHEN date_month IN (4, 6, 9, 11) THEN 30 ELSE 31 END)
        ),
        ADD CONSTRAINT chk_people_date_year CHECK (
          date_year >= 1000
          AND (date_month <> 2 OR date_day <> 29 OR (date_year % 4 = 0 AND (date_year % 100 <> 0 OR date_year % 400 = 0)))
        );
      CREATE INDEX idx_people_user_date ON people(user_id, date_month, date_day) WHERE date_month IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_people_user_date;
      ALTER TABLE people
        DROP CONSTRAINT IF EXISTS chk_people_date_year,
        DROP CONSTRAINT IF EXISTS chk_people_date_day,
        DROP CONSTRAINT IF EXISTS chk_people_date_complete,
        DROP CONSTRAINT IF EXISTS chk_people_date_kind,
        DROP COLUMN IF EXISTS date_year,
        DROP COLUMN IF EXISTS date_day,
        DROP COLUMN IF EXISTS date_month,
        DROP COLUMN IF EXISTS date_kind;
    `);
  }
}
