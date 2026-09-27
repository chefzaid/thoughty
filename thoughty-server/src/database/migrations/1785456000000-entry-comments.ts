import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EntryComments1785456000000 implements MigrationInterface {
  name = 'EntryComments1785456000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE entry_comments (
        id SERIAL PRIMARY KEY,
        entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content VARCHAR(1000) NOT NULL CHECK (char_length(btrim(content)) > 0),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_entry_comments_entry_created
        ON entry_comments(entry_id, created_at);
      CREATE INDEX idx_entry_comments_user_id
        ON entry_comments(user_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS entry_comments;
    `);
  }
}
