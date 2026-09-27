import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserFollows1785369600000 implements MigrationInterface {
  name = 'UserFollows1785369600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_follows (
        follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (follower_id, followed_id),
        CONSTRAINT chk_user_follows_not_self CHECK (follower_id <> followed_id)
      );

      CREATE INDEX idx_user_follows_followed_id
        ON user_follows(followed_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS user_follows;
    `);
  }
}
