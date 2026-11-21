import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Muted and blocked writers. A mute (`user_mutes`) takes a writer's entries and comments out of the
 * reader's feed while a follow stays; a block (`user_blocks`) takes each writer out of the other's feed,
 * comments, followers and leaderboard, and keeps either from following, commenting on, liking or saving
 * the other. Neither is ever shown to the writer it names. Rows go with either account.
 */
export class MuteAndBlock1788652800000 implements MigrationInterface {
  name = 'MuteAndBlock1788652800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_mutes (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        muted_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, muted_id),
        CONSTRAINT chk_user_mutes_not_self CHECK (user_id <> muted_id)
      );
      CREATE INDEX idx_user_mutes_muted ON user_mutes(muted_id);

      CREATE TABLE user_blocks (
        blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (blocker_id, blocked_id),
        CONSTRAINT chk_user_blocks_not_self CHECK (blocker_id <> blocked_id)
      );
      CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS user_blocks; DROP TABLE IF EXISTS user_mutes;');
  }
}
