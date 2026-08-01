import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AiUsageEvents1785110400000 implements MigrationInterface {
  name = 'AiUsageEvents1785110400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_usage_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credential_source VARCHAR(16) NOT NULL
          CHECK (credential_source IN ('personal', 'server')),
        model VARCHAR(200) NOT NULL,
        prompt_tokens INTEGER NOT NULL DEFAULT 0 CHECK (prompt_tokens >= 0),
        completion_tokens INTEGER NOT NULL DEFAULT 0 CHECK (completion_tokens >= 0),
        reasoning_tokens INTEGER NOT NULL DEFAULT 0 CHECK (reasoning_tokens >= 0),
        total_tokens INTEGER NOT NULL DEFAULT 0 CHECK (total_tokens >= 0),
        cost NUMERIC(14, 8) NOT NULL DEFAULT 0 CHECK (cost >= 0),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX idx_ai_usage_events_user_created
        ON ai_usage_events(user_id, created_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS ai_usage_events');
  }
}
