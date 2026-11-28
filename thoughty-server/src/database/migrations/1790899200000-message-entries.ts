import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A message can share one of its sender's public entries (`messages.entry_id`), shown to the other writer only
 * while they can read it in the feed. Deleting the entry for good takes the reference away and keeps the message.
 */
export class MessageEntries1790899200000 implements MigrationInterface {
  name = 'MessageEntries1790899200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE messages ADD COLUMN entry_id INTEGER REFERENCES entries(id) ON DELETE SET NULL;
      CREATE INDEX idx_messages_entry ON messages(entry_id) WHERE entry_id IS NOT NULL;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_messages_entry;
      ALTER TABLE messages DROP COLUMN IF EXISTS entry_id;
    `);
  }
}
