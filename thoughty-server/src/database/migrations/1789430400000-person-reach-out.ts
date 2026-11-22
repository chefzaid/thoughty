import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reach-out reminders on people: `reach_out_days`, how long the writer wants to go at most without being in
 * touch with the person (null: no reminder), and `last_contact_on`, the last day they were in touch, written by
 * the writer or by **Contacted today** in Highlights. Highlights shows the person once that many days have
 * passed since the later of the last contact and the newest entry that mentions them. The writer's people with
 * a reminder are found through `idx_people_user_reach_out`.
 */
export class PersonReachOut1789430400000 implements MigrationInterface {
  name = 'PersonReachOut1789430400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE people
        ADD COLUMN reach_out_days SMALLINT,
        ADD COLUMN last_contact_on DATE,
        ADD CONSTRAINT chk_people_reach_out_days CHECK (reach_out_days BETWEEN 1 AND 366);
      CREATE INDEX idx_people_user_reach_out ON people(user_id) WHERE reach_out_days IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_people_user_reach_out;
      ALTER TABLE people
        DROP CONSTRAINT IF EXISTS chk_people_reach_out_days,
        DROP COLUMN IF EXISTS last_contact_on,
        DROP COLUMN IF EXISTS reach_out_days;
    `);
  }
}
