import { LeaderboardController } from './leaderboard.controller';

describe('LeaderboardController', () => {
  it('delegates the requested period', async () => {
    const service = { getLeaderboard: jest.fn().mockResolvedValue({ period: 'week' }) };

    await expect(
      new LeaderboardController(service as never).getLeaderboard({ period: 'week' }),
    ).resolves.toEqual({ period: 'week' });
    expect(service.getLeaderboard).toHaveBeenCalledWith('week');
  });
});
