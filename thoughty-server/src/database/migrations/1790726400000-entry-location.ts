import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * An optional place on an entry: the name the writer gave it (`location_name`) and, when the browser or an
 * imported app gave them, its coordinates. Both coordinates or neither, each within its range; an entry
 * without a place keeps all three null. Places stay private: the public feed, share links, books and
 * exports never carry them unless the writer asks an export for them.
 */
export class EntryLocation1790726400000 implements MigrationInterface {
  name = 'EntryLocation1790726400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries
        ADD COLUMN location_name VARCHAR(200),
        ADD COLUMN latitude DOUBLE PRECISION,
        ADD COLUMN longitude DOUBLE PRECISION;
      ALTER TABLE entries ADD CONSTRAINT chk_entries_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (latitude IS NOT NULL AND longitude IS NOT NULL
          AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries DROP CONSTRAINT IF EXISTS chk_entries_coordinates;
      ALTER TABLE entries
        DROP COLUMN IF EXISTS longitude,
        DROP COLUMN IF EXISTS latitude,
        DROP COLUMN IF EXISTS location_name;
    `);
  }
}
