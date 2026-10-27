import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Life eras: named date ranges of a writer's life ("University", "The Paris years"), one name per
 * writer whatever its case. An era without an end date is still going on; eras may overlap.
 */
export class LifeEras1786579200000 implements MigrationInterface {
  name = 'LifeEras1786579200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE life_eras (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        color VARCHAR(7),
        emoji VARCHAR(16),
        note VARCHAR(500),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_life_eras_name CHECK (btrim(name) <> ''),
        CONSTRAINT chk_life_eras_dates CHECK (end_date IS NULL OR end_date >= start_date),
        CONSTRAINT chk_life_eras_color CHECK (color IS NULL OR color ~ '^#[0-9A-F]{6}$')
      );

      CREATE UNIQUE INDEX uq_life_eras_user_name ON life_eras(user_id, lower(name));
      CREATE INDEX idx_life_eras_user_start ON life_eras(user_id, start_date);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS life_eras;');
  }
}
