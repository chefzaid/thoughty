import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Messages between writers. A conversation (`conversations`) has its writers (`conversation_members`, each
 * with the newest message they have read) and its messages (`messages`, plain text). A one-to-one
 * conversation names its two writers, the lower id first, so a pair has one conversation; it goes with
 * either account when that account is purged, and a member's messages and read state go with theirs.
 */
export class Conversations1790812800000 implements MigrationInterface {
  name = 'Conversations1790812800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE conversations (
        id SERIAL PRIMARY KEY,
        direct_low_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        direct_high_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_message_at TIMESTAMPTZ,
        CONSTRAINT uq_conversations_direct UNIQUE (direct_low_id, direct_high_id),
        CONSTRAINT chk_conversations_direct_order CHECK (direct_low_id < direct_high_id)
      );
      CREATE TABLE conversation_members (
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        last_read_message_id INTEGER NOT NULL DEFAULT 0,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (conversation_id, user_id)
      );
      CREATE INDEX idx_conversation_members_user ON conversation_members(user_id);
      CREATE TABLE messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body VARCHAR(2000) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_messages_conversation ON messages(conversation_id, id);
      CREATE INDEX idx_messages_sender ON messages(sender_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS conversation_members;
      DROP TABLE IF EXISTS conversations;
    `);
  }
}
