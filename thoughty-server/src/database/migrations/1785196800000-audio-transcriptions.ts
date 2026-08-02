import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AudioTranscriptions1785196800000 implements MigrationInterface {
  name = 'AudioTranscriptions1785196800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attachments
        ADD COLUMN transcript TEXT,
        ADD COLUMN transcribed_at TIMESTAMP;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE attachments
        DROP COLUMN IF EXISTS transcribed_at,
        DROP COLUMN IF EXISTS transcript;
    `);
  }
}
