import type { QueryRunner } from 'typeorm';
import { CommentControls1788566400000 } from './migrations/1788566400000-comment-controls';

describe('CommentControls1788566400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const statements = () =>
    (queryRunner.query as jest.Mock).mock.calls.map(([sql]) => sql as string);

  beforeEach(() => jest.clearAllMocks());

  it('adds the entry policy, hidden and pinned comments, and one pinned comment per entry', async () => {
    await new CommentControls1788566400000().up(queryRunner);

    const [entries, comments, pinned] = statements();
    expect(entries).toContain('ADD COLUMN comment_policy VARCHAR(20) NULL');
    expect(entries).toContain("comment_policy IN ('everyone', 'followers', 'closed')");
    expect(comments).toContain('ADD COLUMN hidden_at TIMESTAMPTZ NULL');
    expect(comments).toContain('ADD COLUMN pinned_at TIMESTAMPTZ NULL');
    expect(comments).toContain('CHECK (pinned_at IS NULL OR hidden_at IS NULL)');
    expect(pinned).toBe(
      'CREATE UNIQUE INDEX uq_entry_comments_pinned ON entry_comments (entry_id) WHERE pinned_at IS NOT NULL;',
    );
  });

  it('removes them again', async () => {
    await new CommentControls1788566400000().down(queryRunner);

    const [index, comments, entries] = statements();
    expect(index).toBe('DROP INDEX IF EXISTS uq_entry_comments_pinned;');
    expect(comments).toContain('DROP COLUMN IF EXISTS pinned_at');
    expect(comments).toContain('DROP COLUMN IF EXISTS hidden_at');
    expect(entries).toContain('DROP COLUMN IF EXISTS comment_policy');
  });
});
