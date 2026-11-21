import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Followed feed topics: a tag whose public entries a reader sees in the feed's Following tab, one row per
 * reader and tag. A topic is its tag ignoring case, stored in lower case, so "Gratitude" and "gratitude"
 * are one topic. Rows go with the reader's account.
 */
export class TopicFollows1788480000000 implements MigrationInterface {
  name = 'TopicFollows1788480000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE topic_follows (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tag VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, tag),
        CONSTRAINT chk_topic_follows_tag CHECK (tag = lower(tag) AND btrim(tag) <> '')
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS topic_follows;');
  }
}
