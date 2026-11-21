import { LeaderboardController } from './leaderboard.controller';

describe('LeaderboardController', () => {
  it('delegates the requested period for the viewer', async () => {
    const service = { getLeaderboard: jest.fn().mockResolvedValue({ period: 'week' }) };

    await expect(
      new LeaderboardController(service as never).getLeaderboard({ userId: 3 } as never, {
        period: 'week',
      }),
    ).resolves.toEqual({ period: 'week' });
    expect(service.getLeaderboard).toHaveBeenCalledWith(3, 'week');
  });
});
