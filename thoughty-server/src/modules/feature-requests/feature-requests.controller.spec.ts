import { FeatureRequestsController } from './feature-requests.controller';

describe('FeatureRequestsController', () => {
  const service = {
    list: jest.fn(),
    getVotedRequestIds: jest.fn(),
    create: jest.fn(),
    vote: jest.fn(),
  };
  const controller = new FeatureRequestsController(service as never);
  const user = { userId: 4 };

  afterEach(() => jest.clearAllMocks());

  it('wraps the public board', async () => {
    service.list.mockResolvedValue([{ id: 1 }]);
    await expect(controller.list()).resolves.toEqual({ requests: [{ id: 1 }] });
  });

  it('returns the current user vote ids', async () => {
    service.getVotedRequestIds.mockResolvedValue([1, 3]);
    await expect(controller.getVotes(user as never)).resolves.toEqual({ requestIds: [1, 3] });
    expect(service.getVotedRequestIds).toHaveBeenCalledWith(4);
  });

  it('delegates creation and voting with the authenticated user id', async () => {
    const dto = { title: 'Mood calendar', details: 'Show patterns by month.' };
    service.create.mockResolvedValue({ id: 8 });
    service.vote.mockResolvedValue({ requestId: 8, votes: 2, voted: true });

    await expect(controller.create(user as never, dto)).resolves.toEqual({ id: 8 });
    await expect(controller.vote(user as never, 8)).resolves.toEqual({
      requestId: 8,
      votes: 2,
      voted: true,
    });
    expect(service.create).toHaveBeenCalledWith(4, dto);
    expect(service.vote).toHaveBeenCalledWith(4, 8);
  });
});
