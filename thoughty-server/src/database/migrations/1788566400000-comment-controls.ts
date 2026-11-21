import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Comment controls on public entries. `entries.comment_policy` says who may comment: `everyone`,
 * `followers` (of the entry's writer) or `closed` (no new comments, the ones there stay readable);
 * NULL follows the writer's `defaultCommentPolicy` setting. A comment the entry's writer hid keeps
 * `hidden_at` and is shown only to its own writer and the entry's; one comment per entry at most is
 * pinned on top (`pinned_at`), and a hidden comment is never the pinned one.
 */
export class CommentControls1788566400000 implements MigrationInterface {
  name = 'CommentControls1788566400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries
        ADD COLUMN comment_policy VARCHAR(20) NULL,
        ADD CONSTRAINT chk_entries_comment_policy
          CHECK (comment_policy IS NULL OR comment_policy IN ('everyone', 'followers', 'closed'));
    `);
    await queryRunner.query(`
      ALTER TABLE entry_comments
        ADD COLUMN hidden_at TIMESTAMPTZ NULL,
        ADD COLUMN pinned_at TIMESTAMPTZ NULL,
        ADD CONSTRAINT chk_entry_comments_pinned_shown CHECK (pinned_at IS NULL OR hidden_at IS NULL);
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX uq_entry_comments_pinned ON entry_comments (entry_id) WHERE pinned_at IS NOT NULL;',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS uq_entry_comments_pinned;');
    await queryRunner.query(`
      ALTER TABLE entry_comments
        DROP CONSTRAINT IF EXISTS chk_entry_comments_pinned_shown,
        DROP COLUMN IF EXISTS pinned_at,
        DROP COLUMN IF EXISTS hidden_at;
    `);
    await queryRunner.query(`
      ALTER TABLE entries
        DROP CONSTRAINT IF EXISTS chk_entries_comment_policy,
        DROP COLUMN IF EXISTS comment_policy;
    `);
  }
}
