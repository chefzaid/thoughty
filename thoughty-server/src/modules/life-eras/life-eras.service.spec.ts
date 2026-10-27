import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import type { LifeEra } from '@/database/entities';
import { LIFE_ERA_LIMIT } from './dto';
import { LifeErasService } from './life-eras.service';

const createdAt = new Date('2026-10-27T09:00:00Z');
const university = {
  id: 3,
  userId: 7,
  name: 'University',
  startDate: '2010-09-01',
  endDate: '2014-06-30',
  color: '#2A9D8F',
  emoji: '🎓',
  note: null,
  createdAt,
  updatedAt: createdAt,
} as LifeEra;
const { userId: _userId, ...universityResponse } = university;

describe('LifeErasService', () => {
  let repository: Record<string, jest.Mock> & { manager?: unknown };
  let queryBuilder: Record<string, jest.Mock>;
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let cache: { invalidateUser: jest.Mock };
  let service: LifeErasService;

  beforeEach(() => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 3, createdAt, updatedAt: createdAt, ...value })),
      findOne: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    manager = { query: jest.fn().mockResolvedValue([]), getRepository: jest.fn(() => repository) };
    repository.manager = { transaction: jest.fn((work) => work(manager)) };
    cache = { invalidateUser: jest.fn() };
    service = new LifeErasService(repository as never, cache as never);
  });

  it('lists the writer’s eras by start date, ongoing ones last on the same start, with the limit', async () => {
    queryBuilder.getMany.mockResolvedValue([university]);

    await expect(service.list(7)).resolves.toEqual({ lifeEras: [universityResponse], limit: LIFE_ERA_LIMIT });
    expect(queryBuilder.where).toHaveBeenCalledWith('era.user_id = :userId', { userId: 7 });
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('era.start_date', 'ASC');
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('era.end_date', 'ASC', 'NULLS LAST');
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith('LOWER(era.name)', 'ASC');
  });

  it('adds an era under the writer’s lock, ongoing when it has no end', async () => {
    const result = await service.create(7, { name: 'Paris', startDate: '2015-01-01' });

    expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1), $2)', ['life_eras', 7]);
    expect(repository.count).toHaveBeenCalledWith({ where: { userId: 7 } });
    expect(repository.save).toHaveBeenCalledWith({
      userId: 7, name: 'Paris', startDate: '2015-01-01', endDate: null, color: null, emoji: null, note: null,
    });
    expect(result).toEqual(expect.objectContaining({ id: 3, name: 'Paris', endDate: null }));
    expect(result).not.toHaveProperty('userId');
  });

  it('refuses an era that ends before it starts, or past the limit', async () => {
    await expectApiError(
      service.create(7, { name: 'Backwards', startDate: '2015-01-01', endDate: '2014-12-31' }),
      BadRequestException,
      'LIFE_ERA_DATES_INVALID',
    );
    await expect(service.create(7, { name: 'One day', startDate: '2015-01-01', endDate: '2015-01-01' })).resolves.toBeDefined();

    repository.count.mockResolvedValue(LIFE_ERA_LIMIT);
    await expectApiError(service.create(7, { name: 'One more', startDate: '2015-01-01' }), BadRequestException, 'LIFE_ERA_LIMIT_REACHED');
  });

  it('turns a name clash into a coded conflict and passes other failures on', async () => {
    repository.save.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
    await expectApiError(service.create(7, { name: 'university', startDate: '2010-01-01' }), ConflictException, 'LIFE_ERA_NAME_TAKEN');

    repository.save.mockRejectedValueOnce(new Error('connection lost'));
    await expect(service.create(7, { name: 'Paris', startDate: '2015-01-01' })).rejects.toThrow('connection lost');
  });

  it('finds only the writer’s own era', async () => {
    repository.findOne.mockResolvedValueOnce(university).mockResolvedValueOnce(null);

    await expect(service.findOwn(7, 3)).resolves.toBe(university);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 3, userId: 7 } });
    await expectApiError(service.findOwn(8, 3), NotFoundException, 'LIFE_ERA_NOT_FOUND');
  });

  it('changes only the given fields, checks the resulting range and drops cached entry lists', async () => {
    repository.findOne.mockResolvedValueOnce({ ...university });
    await expect(service.update(7, 3, { endDate: null, note: 'Lyon' }))
      .resolves.toEqual({ ...universityResponse, endDate: null, note: 'Lyon' });
    expect(cache.invalidateUser).toHaveBeenCalledWith(7);

    repository.findOne.mockResolvedValueOnce({ ...university });
    await expect(service.update(7, 3, { name: 'Uni', startDate: '2011-01-01', color: null, emoji: '📚' }))
      .resolves.toEqual(expect.objectContaining({ name: 'Uni', startDate: '2011-01-01', endDate: '2014-06-30', color: null, emoji: '📚' }));

    repository.findOne.mockResolvedValueOnce({ ...university });
    await expectApiError(service.update(7, 3, { startDate: '2015-01-01' }), BadRequestException, 'LIFE_ERA_DATES_INVALID');

    repository.findOne.mockResolvedValueOnce({ ...university });
    repository.save.mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
    await expectApiError(service.update(7, 3, { name: 'Paris' }), ConflictException, 'LIFE_ERA_NAME_TAKEN');

    repository.findOne.mockResolvedValueOnce(null);
    await expectApiError(service.update(7, 4, { name: 'Gone' }), NotFoundException, 'LIFE_ERA_NOT_FOUND');
  });

  it('deletes only the writer’s own era, widens the saved searches filtered by it and drops cached lists', async () => {
    await expect(service.delete(7, 3)).resolves.toEqual({ success: true });
    expect(repository.delete).toHaveBeenCalledWith({ id: 3, userId: 7 });
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining("jsonb_set(filters, '{eraId}', 'null'::jsonb)"), [7, '3']);
    expect(cache.invalidateUser).toHaveBeenCalledWith(7);

    cache.invalidateUser.mockClear();
    repository.delete.mockResolvedValueOnce({ affected: 0 });
    await expectApiError(service.delete(8, 3), NotFoundException, 'LIFE_ERA_NOT_FOUND');
    expect(cache.invalidateUser).not.toHaveBeenCalled();
  });
});
