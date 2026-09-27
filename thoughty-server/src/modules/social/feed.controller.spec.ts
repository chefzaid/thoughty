import { FeedController } from './feed.controller';

describe('FeedController', () => {
  it('delegates the authenticated feed scope to PublicFeedService', async () => {
    const publicFeedService = { getFeed: jest.fn() };
    const expected = { entries: [], total: 0, page: 2, totalPages: 0, hasMore: false };
    publicFeedService.getFeed.mockResolvedValue(expected);
    const query = { scope: 'mine' as const, page: 2, limit: 5 };

    await expect(
      new FeedController(publicFeedService as never).getFeed({ userId: 1 } as never, query),
    ).resolves.toBe(expected);
    expect(publicFeedService.getFeed).toHaveBeenCalledWith(1, query);
  });
});
