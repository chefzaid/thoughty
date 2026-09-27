import { FollowsController } from './follows.controller';

describe('FollowsController', () => {
  const service = { list: jest.fn(), follow: jest.fn(), unfollow: jest.fn() };
  const controller = new FollowsController(service as never);
  const user = { userId: 4 };

  afterEach(() => jest.clearAllMocks());

  it('lists follows for the authenticated user', async () => {
    service.list.mockResolvedValue({ following: [], followerCount: 2 });
    await expect(controller.list(user as never)).resolves.toEqual({
      following: [],
      followerCount: 2,
    });
    expect(service.list).toHaveBeenCalledWith(4);
  });

  it('delegates follow and unfollow with the authenticated user id', async () => {
    service.follow.mockResolvedValue({ userId: 9, following: true });
    service.unfollow.mockResolvedValue({ userId: 9, following: false });

    await expect(controller.follow(user as never, 9)).resolves.toEqual({
      userId: 9,
      following: true,
    });
    await expect(controller.unfollow(user as never, 9)).resolves.toEqual({
      userId: 9,
      following: false,
    });
    expect(service.follow).toHaveBeenCalledWith(4, 9);
    expect(service.unfollow).toHaveBeenCalledWith(4, 9);
  });
});
