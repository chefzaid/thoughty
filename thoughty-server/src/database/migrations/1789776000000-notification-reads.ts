import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notifications: the comments, likes and new followers a writer gets are read from the tables that hold them,
 * so the only thing kept is when the writer last opened their notifications (`notification_reads`, one row per
 * account, gone with it); what came after is new. Every account that exists already starts from now, so the
 * likes and follows from before notifications existed are not all announced as new at once; an account
 * without a row (created from now on) has seen nothing yet.
 */
export class NotificationReads1789776000000 implements MigrationInterface {
  name = 'NotificationReads1789776000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE notification_reads (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await queryRunner.query('INSERT INTO notification_reads (user_id) SELECT id FROM users;');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS notification_reads;');
  }
}
