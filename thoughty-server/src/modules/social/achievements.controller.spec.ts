import { AchievementsController } from './achievements.controller';

describe('AchievementsController', () => {
  it('returns the authenticated user’s own achievements', async () => {
    const service = { getAchievements: jest.fn().mockResolvedValue({ karma: 3 }) };

    await expect(
      new AchievementsController(service as never).getAchievements({ userId: 4 } as never),
    ).resolves.toEqual({ karma: 3 });
    expect(service.getAchievements).toHaveBeenCalledWith(4);
  });
});
