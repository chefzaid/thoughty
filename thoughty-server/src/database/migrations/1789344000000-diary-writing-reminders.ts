import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-diary writing reminders: a diary can carry its own hour for the writing reminder email, one row per
 * diary, shaped like the opt-in email rows so the same worker schedules it. The time zone follows the
 * writer's account reminder (or the browser's zone when there is none yet); deleting the diary or the
 * account removes the row.
 */
export class DiaryWritingReminders1789344000000 implements MigrationInterface {
  name = 'DiaryWritingReminders1789344000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE diary_writing_reminders (
        diary_id INTEGER PRIMARY KEY REFERENCES diaries(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        delivery_hour SMALLINT NOT NULL,
        time_zone VARCHAR(64) NOT NULL,
        next_send_at TIMESTAMPTZ NOT NULL,
        last_sent_on DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_diary_writing_reminders_hour CHECK (delivery_hour BETWEEN 0 AND 23)
      );
      CREATE INDEX idx_diary_writing_reminders_user ON diary_writing_reminders(user_id);
      CREATE INDEX idx_diary_writing_reminders_due
        ON diary_writing_reminders(next_send_at)
        WHERE enabled;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS diary_writing_reminders;`);
  }
}
