import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Memoir photo prompts: an old photo and the story of what is happening in it, kept as a private entry in
 * the memoir diary with the photo placed in its text. Each row marks one such entry, so the memoir lists
 * its photo stories and counts their words; deleting the entry or the account removes the row.
 */
export class MemoirPhotoAnswers1789257600000 implements MigrationInterface {
  name = 'MemoirPhotoAnswers1789257600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE memoir_photo_answers (
        entry_id INTEGER PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_memoir_photo_answers_user ON memoir_photo_answers(user_id, created_at);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS memoir_photo_answers;`);
  }
}
