import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Not this week" on a weekly memoir question: the question sits out until `snoozed_until`, the writer's
 * own day (in the program's time zone) of the fourth weekly delivery after it was set aside, then comes
 * back ahead of the rest of the queue. One row per set-aside question, removed when the question is
 * offered again; stopping the memoir (deleting the program) clears them.
 */
export class MemoirSnoozes1787616000000 implements MigrationInterface {
  name = 'MemoirSnoozes1787616000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE memoir_snoozes (
        program_id INTEGER NOT NULL REFERENCES memoir_programs(id) ON DELETE CASCADE,
        question_id VARCHAR(64) NOT NULL,
        snoozed_until DATE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (program_id, question_id)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS memoir_snoozes;
    `);
  }
}
