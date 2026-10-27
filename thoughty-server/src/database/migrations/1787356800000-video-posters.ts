import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A video attachment's poster frame: the storage key and size of the small JPEG the browser draws
 * from the video at upload. Both are set together or not at all.
 */
export class VideoPosters1787356800000 implements MigrationInterface {
  name = 'VideoPosters1787356800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attachments
        ADD COLUMN poster_filename VARCHAR(255),
        ADD COLUMN poster_size INTEGER,
        ADD CONSTRAINT chk_attachments_poster_pair
          CHECK ((poster_filename IS NULL) = (poster_size IS NULL));
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attachments
        DROP CONSTRAINT IF EXISTS chk_attachments_poster_pair,
        DROP COLUMN IF EXISTS poster_size,
        DROP COLUMN IF EXISTS poster_filename;
    `);
  }
}
