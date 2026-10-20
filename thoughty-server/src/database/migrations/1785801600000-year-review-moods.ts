import type { MigrationInterface, QueryRunner } from 'typeorm';

export class YearReviewMoods1785801600000 implements MigrationInterface {
  name = 'YearReviewMoods1785801600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE year_review_moods (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        diary_id INTEGER REFERENCES diaries(id) ON DELETE CASCADE,
        year SMALLINT NOT NULL,
        months JSONB NOT NULL,
        summary TEXT NOT NULL,
        analyzed_entries INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_year_review_moods_year CHECK (year BETWEEN 1900 AND 2200)
      );

      CREATE UNIQUE INDEX uq_year_review_moods_scope
        ON year_review_moods(user_id, year, COALESCE(diary_id, 0));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS year_review_moods;');
  }
}
