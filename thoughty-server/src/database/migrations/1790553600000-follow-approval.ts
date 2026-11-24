import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Followers by approval: a writer who turns `users.followers_by_approval` on (off for every account) has
 * new follows wait as `pending` requests until approved, and only approved followers read their public
 * entries. Every follow made before is `approved`, so followers a writer already has stay. Going back drops
 * the requests still waiting first, so none becomes a follow that was never approved.
 */
export class FollowApproval1790553600000 implements MigrationInterface {
  name = 'FollowApproval1790553600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN followers_by_approval BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE user_follows ADD COLUMN status VARCHAR(8) NOT NULL DEFAULT 'approved';
      ALTER TABLE user_follows ADD CONSTRAINT chk_user_follows_status CHECK (status IN ('approved', 'pending'));
      CREATE INDEX idx_user_follows_pending ON user_follows(followed_id) WHERE status = 'pending';
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM user_follows WHERE status = 'pending';
      DROP INDEX IF EXISTS idx_user_follows_pending;
      ALTER TABLE user_follows DROP CONSTRAINT IF EXISTS chk_user_follows_status;
      ALTER TABLE user_follows DROP COLUMN IF EXISTS status;
      ALTER TABLE users DROP COLUMN IF EXISTS followers_by_approval;
    `);
  }
}
