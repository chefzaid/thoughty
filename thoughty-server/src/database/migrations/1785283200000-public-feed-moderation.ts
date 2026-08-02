import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PublicFeedModeration1785283200000 implements MigrationInterface {
  name = 'PublicFeedModeration1785283200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries
        ADD COLUMN moderation_status VARCHAR(20) NOT NULL DEFAULT 'visible'
        CHECK (moderation_status IN ('visible', 'hidden', 'under_review', 'removed'));

      CREATE INDEX idx_entries_public_feed
        ON entries(visibility, moderation_status, is_archived, created_at DESC);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_entries_public_feed;
      ALTER TABLE entries DROP COLUMN IF EXISTS moderation_status;
    `);
  }
}
