import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The opt-in year in review email: one row per writer who has saved the setting, shaped like the monthly
 * recap's. The worker finds the rows that are due (January 1 of the writer's year at the chosen hour)
 * through the partial index on `next_send_at`, and `last_sent_on` (the writer's local day of the last
 * email) keeps a year from getting two. Deleting the chosen diary widens it to all diaries.
 */
export class YearReviewEmails1790208000000 implements MigrationInterface {
  name = 'YearReviewEmails1790208000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE year_review_emails (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        delivery_hour SMALLINT NOT NULL,
        time_zone VARCHAR(64) NOT NULL,
        diary_id INTEGER REFERENCES diaries(id) ON DELETE SET NULL,
        next_send_at TIMESTAMPTZ NOT NULL,
        last_sent_on DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_year_review_emails_hour CHECK (delivery_hour BETWEEN 0 AND 23)
      );

      CREATE INDEX idx_year_review_emails_due
        ON year_review_emails(next_send_at)
        WHERE enabled;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS year_review_emails;`);
  }
}
