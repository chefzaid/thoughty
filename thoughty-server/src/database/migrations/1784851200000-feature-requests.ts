import type { MigrationInterface, QueryRunner } from 'typeorm';

export class FeatureRequests1784851200000 implements MigrationInterface {
  name = 'FeatureRequests1784851200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE feature_requests (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(120) NOT NULL,
        details TEXT NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'open'
          CHECK (status IN ('open', 'reviewing', 'planned')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_feature_requests_created_at
        ON feature_requests(created_at DESC);

      CREATE TABLE feature_request_votes (
        id SERIAL PRIMARY KEY,
        feature_request_id INTEGER NOT NULL REFERENCES feature_requests(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_feature_request_votes_request_user
          UNIQUE(feature_request_id, user_id)
      );

      CREATE INDEX idx_feature_request_votes_request_id
        ON feature_request_votes(feature_request_id);
      CREATE INDEX idx_feature_request_votes_user_id
        ON feature_request_votes(user_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS feature_request_votes;
      DROP TABLE IF EXISTS feature_requests;
    `);
  }
}
