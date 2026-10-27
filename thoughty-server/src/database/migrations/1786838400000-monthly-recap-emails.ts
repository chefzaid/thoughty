import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The opt-in monthly recap email: one row per writer who has saved the setting, shaped like the
 * "On this day" email's. The worker finds the rows that are due (the 1st of the writer's month at the
 * chosen hour) through the partial index on `next_send_at`, and `last_sent_on` (the writer's local day
 * of the last email) keeps a month from getting two. Deleting the chosen diary widens it to all diaries.
 */
export class MonthlyRecapEmails1786838400000 implements MigrationInterface {
  name = 'MonthlyRecapEmails1786838400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE monthly_recap_emails (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        delivery_hour SMALLINT NOT NULL,
        time_zone VARCHAR(64) NOT NULL,
        diary_id INTEGER REFERENCES diaries(id) ON DELETE SET NULL,
        next_send_at TIMESTAMPTZ NOT NULL,
        last_sent_on DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_monthly_recap_emails_hour CHECK (delivery_hour BETWEEN 0 AND 23)
      );

      CREATE INDEX idx_monthly_recap_emails_due
        ON monthly_recap_emails(next_send_at)
        WHERE enabled;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS monthly_recap_emails;`);
  }
}
