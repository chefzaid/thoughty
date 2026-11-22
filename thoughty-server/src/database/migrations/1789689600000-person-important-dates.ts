import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Several important dates on a person: `person_dates` holds each birthday or anniversary, with an optional label of
 * what it marks (a wedding, the day they met), the month and day it comes back on each year, and the year when the
 * writer knows it. The checks are those of the columns it replaces on `people` (a day the month never has, 29
 * February in a year that had none, a year before 1000), a person has at most one birthday, and the dates go with
 * their person. Each person's date moves here, then the old columns, their checks and their index are dropped.
 * Going back keeps one date per person, the birthday first, then the earliest in the year.
 */
export class PersonImportantDates1789689600000 implements MigrationInterface {
  name = 'PersonImportantDates1789689600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE person_dates (
        id SERIAL PRIMARY KEY,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        kind VARCHAR(16) NOT NULL,
        label VARCHAR(40),
        month SMALLINT NOT NULL,
        day SMALLINT NOT NULL,
        year SMALLINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_person_dates_kind CHECK (kind IN ('birthday', 'anniversary')),
        CONSTRAINT chk_person_dates_label CHECK (label <> ''),
        CONSTRAINT chk_person_dates_day CHECK (
          month BETWEEN 1 AND 12
          AND day BETWEEN 1 AND (CASE WHEN month = 2 THEN 29 WHEN month IN (4, 6, 9, 11) THEN 30 ELSE 31 END)
        ),
        CONSTRAINT chk_person_dates_year CHECK (
          year >= 1000 AND (month <> 2 OR day <> 29 OR (year % 4 = 0 AND (year % 100 <> 0 OR year % 400 = 0)))
        )
      );
      CREATE INDEX idx_person_dates_person ON person_dates(person_id);
      CREATE INDEX idx_person_dates_day ON person_dates(month, day);
      CREATE UNIQUE INDEX uq_person_dates_birthday ON person_dates(person_id) WHERE kind = 'birthday';
      INSERT INTO person_dates (person_id, kind, month, day, year)
      SELECT id, date_kind, date_month, date_day, date_year FROM people WHERE date_month IS NOT NULL ORDER BY id;
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

  async down(queryRunner: QueryRunner): Promise<void> {
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
      UPDATE people p SET date_kind = d.kind, date_month = d.month, date_day = d.day, date_year = d.year
        FROM (
          SELECT DISTINCT ON (person_id) person_id, kind, month, day, year
            FROM person_dates
           ORDER BY person_id, kind <> 'birthday', month, day, id
        ) d
       WHERE d.person_id = p.id;
      CREATE INDEX idx_people_user_date ON people(user_id, date_month, date_day) WHERE date_month IS NOT NULL;
      DROP TABLE IF EXISTS person_dates;
    `);
  }
}
