import type { QueryRunner } from 'typeorm';
import { PublicFeedModeration1785283200000 } from './migrations/1785283200000-public-feed-moderation';

describe('PublicFeedModeration1785283200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('adds a separate moderation state and feed index', async () => {
    await new PublicFeedModeration1785283200000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ADD COLUMN moderation_status');
    expect(sql).toContain("DEFAULT 'visible'");
    expect(sql).toContain("'under_review'");
    expect(sql).toContain('CREATE INDEX idx_entries_public_feed');
  });

  it('removes the feed index and moderation state', async () => {
    await new PublicFeedModeration1785283200000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP INDEX IF EXISTS idx_entries_public_feed');
    expect(sql).toContain('DROP COLUMN IF EXISTS moderation_status');
  });
});
