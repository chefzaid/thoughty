import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Diaries can name a default entry template, which the composer starts from when the diary is picked
 * and the composer is empty. The template lives in the writer's settings (or is built in), so the diary
 * keeps only its ID: one that no longer resolves (a custom template deleted since) is ignored.
 */
export class DiaryDefaultTemplates1787961600000 implements MigrationInterface {
  name = 'DiaryDefaultTemplates1787961600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE diaries
        ADD COLUMN default_template_id VARCHAR(100),
        ADD CONSTRAINT chk_diaries_default_template_id
          CHECK (default_template_id IS NULL OR default_template_id ~ '^[A-Za-z0-9_-]{1,100}$');
    `);
  }

  /** The default templates are dropped with their column. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE diaries
        DROP CONSTRAINT IF EXISTS chk_diaries_default_template_id,
        DROP COLUMN IF EXISTS default_template_id;
    `);
  }
}
