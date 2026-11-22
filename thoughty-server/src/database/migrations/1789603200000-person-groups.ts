import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Groups on people: `groups`, the names of the writer's own groups a person belongs to (Friends, Family,
 * Colleagues…), set on the People page, empty when there are none. The API trims each name, keeps it to 40
 * characters, ten per person, one spelling per name ignoring case; merging two people joins their groups, so the
 * column itself only refuses a missing or empty name.
 */
export class PersonGroups1789603200000 implements MigrationInterface {
  name = 'PersonGroups1789603200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE people
        ADD COLUMN groups TEXT[] NOT NULL DEFAULT '{}',
        ADD CONSTRAINT chk_people_groups_named CHECK (array_position(groups, NULL) IS NULL AND '' <> ALL (groups));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE people
        DROP CONSTRAINT IF EXISTS chk_people_groups_named,
        DROP COLUMN IF EXISTS groups;
    `);
  }
}
