import { BadRequestException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { Person } from '@/database/entities';
import { PEOPLE_LIMIT } from '@/modules/entries';
import { PeopleService } from './people.service';

const createdAt = new Date('2026-10-27T09:00:00Z');
const marieRow = { id: 12, name: 'Marie', handles: ['marie'], entryCount: '3', lastMentionedOn: '2026-10-20', createdAt, updatedAt: createdAt };
const marie = { ...marieRow, entryCount: 3 };

describe('PeopleService', () => {
  let repository: Record<string, jest.Mock> & { manager?: unknown };
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let cache: { invalidateUser: jest.Mock };
  let service: PeopleService;

  beforeEach(() => {
    manager = { query: jest.fn().mockResolvedValue([marieRow]), getRepository: jest.fn(() => repository) };
    repository = {
      findOne: jest.fn(),
      save: jest.fn(async (value) => value),
      count: jest.fn().mockResolvedValue(2),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    repository.manager = { ...manager, transaction: jest.fn((work) => work(manager)) };
    cache = { invalidateUser: jest.fn() };
    service = new PeopleService(repository as never, cache as never);
  });

  it('lists the writer’s people with their handles, counts and the limit', async () => {
    (repository.manager as { query: jest.Mock }).query.mockResolvedValue([marieRow, { ...marieRow, id: 13, name: 'Zoë', handles: null, lastMentionedOn: null }]);

    await expect(service.list(7)).resolves.toEqual({
      people: [marie, { ...marie, id: 13, name: 'Zoë', handles: [], lastMentionedOn: null }],
      limit: PEOPLE_LIMIT,
    });
    const [sql, parameters] = (repository.manager as { query: jest.Mock }).query.mock.calls[0];
    expect(sql).toContain('LEFT JOIN entries e ON e.id = ep.entry_id AND e.deleted_at IS NULL');
    expect(parameters).toEqual([7, null]);
  });

  it('renames only the writer’s own person', async () => {
    repository.findOne.mockResolvedValueOnce({ id: 12, userId: 7, name: 'Marie' }).mockResolvedValueOnce(null);

    await expect(service.rename(7, 12, { name: 'Marie Curie' })).resolves.toEqual(marie);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 12, userId: 7 } });
    expect(repository.save).toHaveBeenCalledWith({ id: 12, userId: 7, name: 'Marie Curie' });
    await expectApiError(service.rename(8, 12, { name: 'Mine' }), NotFoundException, 'PERSON_NOT_FOUND');
  });

  it('merges a duplicate under the people lock: handles, entries and saved searches move, then it goes', async () => {
    await expect(service.merge(7, 12, { duplicateId: 14 })).resolves.toEqual(marie);

    const statements = manager.query.mock.calls.map(([sql, parameters]) => [String(sql).replace(/\s+/g, ' ').trim(), parameters]);
    expect(statements[0]).toEqual(['SELECT pg_advisory_xact_lock(hashtext($1), $2)', ['people', 7]]);
    expect(repository.count).toHaveBeenCalledWith({ where: { id: In([12, 14]), userId: 7 } });
    expect(statements[1]).toEqual(['UPDATE person_handles SET person_id = $1 WHERE person_id = $2', [12, 14]]);
    expect(statements[2][0]).toContain('INSERT INTO entry_people (entry_id, person_id) SELECT entry_id, $1 FROM entry_people WHERE person_id = $2 ON CONFLICT DO NOTHING');
    expect(statements[3]).toEqual([expect.stringContaining("jsonb_set(filters, '{personId}', to_jsonb($2::int))"), [7, 12, '14']]);
    expect(manager.getRepository).toHaveBeenCalledWith(Person);
    expect(repository.delete).toHaveBeenCalledWith({ id: 14, userId: 7 });
    expect(repository.update).toHaveBeenCalledWith({ id: 12, userId: 7 }, { updatedAt: expect.any(Date) });
    expect(cache.invalidateUser).toHaveBeenCalledWith(7);
  });

  it('refuses to merge a person into themselves or with someone else’s person', async () => {
    await expectApiError(service.merge(7, 12, { duplicateId: 12 }), BadRequestException, 'PERSON_MERGE_SAME');

    repository.count.mockResolvedValue(1);
    await expectApiError(service.merge(7, 12, { duplicateId: 99 }), NotFoundException, 'PERSON_NOT_FOUND');
    expect(repository.delete).not.toHaveBeenCalled();
    expect(cache.invalidateUser).not.toHaveBeenCalled();
  });

  it('deletes a person and widens the saved searches for them, or says they are not found', async () => {
    await expect(service.delete(7, 12)).resolves.toEqual({ success: true });
    expect(repository.delete).toHaveBeenCalledWith({ id: 12, userId: 7 });
    expect(manager.query).toHaveBeenLastCalledWith(expect.stringContaining("jsonb_set(filters, '{personId}', 'null'::jsonb)"), [7, '12']);
    expect(cache.invalidateUser).toHaveBeenCalledWith(7);

    repository.delete.mockResolvedValue({ affected: 0 });
    await expectApiError(service.delete(7, 99), NotFoundException, 'PERSON_NOT_FOUND');
  });
});
