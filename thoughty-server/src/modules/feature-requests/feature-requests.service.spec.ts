import { NotFoundException } from '@nestjs/common';
import { FeatureRequest, FeatureRequestVote } from '@/database/entities';
import { FeatureRequestsService } from './feature-requests.service';

function createListQueryBuilder(rows: unknown[]) {
  return {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
}

function createInsertQueryBuilder() {
  return {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({}),
  };
}

describe('FeatureRequestsService', () => {
  it('returns a bounded board with normalized counts and dates', async () => {
    const queryBuilder = createListQueryBuilder([
      {
        id: '7',
        title: 'Mood calendar',
        details: 'Show patterns by month.',
        status: 'open',
        votes: '12',
        createdAt: '2026-07-23T18:30:00.000Z',
      },
    ]);
    const service = new FeatureRequestsService(
      { createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) } as never,
      {} as never,
      {} as never,
    );

    await expect(service.list()).resolves.toEqual([
      {
        id: 7,
        title: 'Mood calendar',
        details: 'Show patterns by month.',
        status: 'open',
        votes: 12,
        createdAt: '2026-07-23T18:30:00.000Z',
      },
    ]);
    expect(queryBuilder.take).toHaveBeenCalledWith(100);
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('COUNT(vote.id)', 'DESC');
  });

  it('creates a request and its first vote in one transaction', async () => {
    const createdAt = new Date('2026-07-23T18:30:00.000Z');
    const requestRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue({
        id: 8,
        title: 'Mood calendar',
        details: 'Show patterns by month.',
        status: 'open',
        createdAt,
      }),
    };
    const voteRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockResolvedValue({ id: 1 }),
    };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === FeatureRequest ? requestRepository : voteRepository,
      ),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    const service = new FeatureRequestsService({} as never, {} as never, dataSource as never);

    await expect(
      service.create(4, {
        title: 'Mood calendar',
        details: 'Show patterns by month.',
      }),
    ).resolves.toEqual({
      id: 8,
      title: 'Mood calendar',
      details: 'Show patterns by month.',
      status: 'open',
      votes: 1,
      createdAt: createdAt.toISOString(),
    });
    expect(requestRepository.create).toHaveBeenCalledWith({
      userId: 4,
      title: 'Mood calendar',
      details: 'Show patterns by month.',
      status: 'open',
    });
    expect(voteRepository.create).toHaveBeenCalledWith({ featureRequestId: 8, userId: 4 });
  });

  it('lists request ids already voted for by the user', async () => {
    const voteRepository = {
      find: jest.fn().mockResolvedValue([{ featureRequestId: 2 }, { featureRequestId: 9 }]),
    };
    const service = new FeatureRequestsService({} as never, voteRepository as never, {} as never);

    await expect(service.getVotedRequestIds(4)).resolves.toEqual([2, 9]);
    expect(voteRepository.find).toHaveBeenCalledWith({
      where: { userId: 4 },
      select: { featureRequestId: true },
    });
  });

  it('records a vote idempotently and returns the authoritative count', async () => {
    const insertBuilder = createInsertQueryBuilder();
    const voteRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(insertBuilder),
      count: jest.fn().mockResolvedValue(13),
    };
    const featureRequestRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 7 }),
    };
    const service = new FeatureRequestsService(
      featureRequestRepository as never,
      voteRepository as never,
      {} as never,
    );

    await expect(service.vote(4, 7)).resolves.toEqual({
      requestId: 7,
      votes: 13,
      voted: true,
    });
    expect(insertBuilder.into).toHaveBeenCalledWith(FeatureRequestVote);
    expect(insertBuilder.values).toHaveBeenCalledWith({ featureRequestId: 7, userId: 4 });
    expect(insertBuilder.orIgnore).toHaveBeenCalled();
  });

  it('rejects votes for requests that do not exist', async () => {
    const featureRequestRepository = { findOne: jest.fn().mockResolvedValue(null) };
    const voteRepository = { createQueryBuilder: jest.fn() };
    const service = new FeatureRequestsService(
      featureRequestRepository as never,
      voteRepository as never,
      {} as never,
    );

    await expect(service.vote(4, 999)).rejects.toThrow(NotFoundException);
    expect(voteRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
