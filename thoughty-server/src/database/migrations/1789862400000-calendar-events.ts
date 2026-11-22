import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Calendar events: the events of the calendar files (ICS) a writer imports, shown in the composer on
 * their day. One row per event and account (`UID`), so a file imported again updates its events; gone
 * with the account. An all-day event keeps its first and last days, a timed one its start and end.
 */
export class CalendarEvents1789862400000 implements MigrationInterface {
  name = 'CalendarEvents1789862400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE calendar_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        uid VARCHAR(255) NOT NULL,
        summary VARCHAR(200) NOT NULL,
        location VARCHAR(200),
        all_day BOOLEAN NOT NULL,
        starts_at TIMESTAMPTZ,
        ends_at TIMESTAMPTZ,
        start_date DATE,
        end_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_calendar_events_user_uid UNIQUE (user_id, uid),
        CONSTRAINT chk_calendar_events_when CHECK (
          (all_day AND start_date IS NOT NULL AND end_date >= start_date AND starts_at IS NULL AND ends_at IS NULL)
          OR (NOT all_day AND starts_at IS NOT NULL AND ends_at >= starts_at AND start_date IS NULL AND end_date IS NULL)
        )
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS calendar_events;');
  }
}
