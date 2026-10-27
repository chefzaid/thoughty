import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Diaries get an optional writing goal: a number of entries each Monday-to-Sunday week (1 to 50)
 * or of words each day (10 to 10,000). The type and target are set together or both left empty,
 * and the goal goes with its diary when the diary or the account is deleted.
 */
export class DiaryGoals1786406400000 implements MigrationInterface {
  name = 'DiaryGoals1786406400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE diaries
        ADD COLUMN goal_type VARCHAR(20),
        ADD COLUMN goal_target INTEGER,
        -- COALESCE turns the unknown that a lone NULL yields into a refusal
        ADD CONSTRAINT chk_diaries_goal CHECK (COALESCE(
          (goal_type IS NULL AND goal_target IS NULL)
          OR (goal_type = 'entries_per_week' AND goal_target BETWEEN 1 AND 50)
          OR (goal_type = 'words_per_day' AND goal_target BETWEEN 10 AND 10000),
          FALSE
        ));
    `);
  }

  /** Goals are dropped with their columns. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE diaries
        DROP CONSTRAINT IF EXISTS chk_diaries_goal,
        DROP COLUMN IF EXISTS goal_target,
        DROP COLUMN IF EXISTS goal_type;
    `);
  }
}
