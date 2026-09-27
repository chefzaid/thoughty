import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Likes1785542400000 implements MigrationInterface {
  name = 'Likes1785542400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE entry_likes (
        entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (entry_id, user_id)
      );

      CREATE INDEX idx_entry_likes_user_id
        ON entry_likes(user_id);

      CREATE TABLE comment_likes (
        comment_id INTEGER NOT NULL REFERENCES entry_comments(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (comment_id, user_id)
      );

      CREATE INDEX idx_comment_likes_user_id
        ON comment_likes(user_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS comment_likes;
      DROP TABLE IF EXISTS entry_likes;
    `);
  }
}
