import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notes on people: `notes`, the writer's own free text about a person (how they met, what they like, a gift
 * idea), edited on the People page and null when there is none. The API keeps each saved note to 2,000
 * characters; merging two people joins their notes, so the column itself has no length limit.
 */
export class PersonNotes1789516800000 implements MigrationInterface {
  name = 'PersonNotes1789516800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE people
        ADD COLUMN notes TEXT,
        ADD CONSTRAINT chk_people_notes_not_blank CHECK (notes IS NULL OR btrim(notes) <> '');
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE people
        DROP CONSTRAINT IF EXISTS chk_people_notes_not_blank,
        DROP COLUMN IF EXISTS notes;
    `);
  }
}
