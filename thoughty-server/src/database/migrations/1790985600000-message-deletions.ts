import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A writer can delete a message, or a whole conversation, for themselves only. A message deleted for one writer
 * is kept in `message_deletions`; deleting a conversation moves that writer's `deleted_up_to_message_id` to its
 * newest message, so only newer ones show for them. A message no member still has is deleted for good.
 */
export class MessageDeletions1790985600000 implements MigrationInterface {
  name = 'MessageDeletions1790985600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE conversation_members ADD COLUMN deleted_up_to_message_id INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE message_deletions (
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        deleted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id)
      );
      CREATE INDEX idx_message_deletions_user ON message_deletions(user_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS message_deletions;
      ALTER TABLE conversation_members DROP COLUMN IF EXISTS deleted_up_to_message_id;
    `);
  }
}
