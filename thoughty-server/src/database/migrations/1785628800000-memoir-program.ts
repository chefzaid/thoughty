import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MemoirProgram1785628800000 implements MigrationInterface {
  name = 'MemoirProgram1785628800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE memoir_programs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        diary_id INTEGER REFERENCES diaries(id) ON DELETE SET NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'active',
        email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        delivery_weekday SMALLINT NOT NULL,
        time_zone VARCHAR(64) NOT NULL DEFAULT 'UTC',
        current_question_id VARCHAR(64),
        current_question_at TIMESTAMPTZ,
        next_delivery_at TIMESTAMPTZ NOT NULL,
        last_emailed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_memoir_programs_status CHECK (status IN ('active', 'paused')),
        CONSTRAINT chk_memoir_programs_weekday CHECK (delivery_weekday BETWEEN 0 AND 6)
      );

      CREATE INDEX idx_memoir_programs_due
        ON memoir_programs(next_delivery_at)
        WHERE status = 'active';

      CREATE TABLE memoir_answers (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id VARCHAR(64) NOT NULL,
        entry_id INTEGER NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, question_id)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS memoir_answers;
      DROP TABLE IF EXISTS memoir_programs;
    `);
  }
}
