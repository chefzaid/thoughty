import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Memoir themes: the themed chapters (migration, careers, faith, war and history, parenthood) a writer
 * adds to the weekly questions of their guided memoir. Theme IDs come from the catalogue in code, which
 * checks them; existing programs keep the year of questions they had, with no theme.
 */
export class MemoirThemes1788998400000 implements MigrationInterface {
  name = 'MemoirThemes1788998400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE memoir_programs ADD COLUMN themes TEXT[] NOT NULL DEFAULT '{}';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE memoir_programs DROP COLUMN IF EXISTS themes;
    `);
  }
}
