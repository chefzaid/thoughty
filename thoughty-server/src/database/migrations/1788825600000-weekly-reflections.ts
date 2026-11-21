import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Weekly reflection: the AI reading of the past seven days of a writer's entries (the themes that came back,
 * a short summary and one question for the week ahead), made only when the writer asks and kept until they
 * ask again, one per writer and diary scope. Rows go with the account or the diary.
 */
export class WeeklyReflections1788825600000 implements MigrationInterface {
  name = 'WeeklyReflections1788825600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE weekly_reflections (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        diary_id INTEGER REFERENCES diaries(id) ON DELETE CASCADE,
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        themes JSONB NOT NULL,
        summary TEXT NOT NULL,
        question TEXT NOT NULL,
        analyzed_entries INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_weekly_reflections_week CHECK (week_end = week_start + 6)
      );

      CREATE UNIQUE INDEX uq_weekly_reflections_scope
        ON weekly_reflections(user_id, COALESCE(diary_id, 0));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS weekly_reflections;');
  }
}
