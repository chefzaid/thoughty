import { BadRequestException, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { Person } from '@/database/entities';
import { PEOPLE_LIMIT } from '@/modules/entries';
import { PeopleService } from './people.service';

const createdAt = new Date('2026-10-27T09:00:00Z');
const noDate = { dateKind: null, dateMonth: null, dateDay: null, dateYear: null };
const noReachOut = { reachOutDays: null, lastContactOn: null };
const marieRow = { id: 12, name: 'Marie', handles: ['marie'], entryCount: '3', lastMentionedOn: '2026-10-20', ...noDate, ...noReachOut, notes: null, groups: [], createdAt, updatedAt: createdAt };
const marie = { id: 12, name: 'Marie', handles: ['marie'], entryCount: 3, lastMentionedOn: '2026-10-20', date: null, ...noReachOut, notes: null, groups: [], createdAt, updatedAt: createdAt };

describe('PeopleService', () => {
  let repository: Record<string, jest.Mock> & { manager?: unknown };
  let manager: { query: jest.Mock; getRepository: jest.Mock };
  let service: PeopleService;

  beforeEach(() => {
    manager = { query: jest.fn().mockResolvedValue([marieRow]), getRepository: jest.fn(() => repository) };
    repository = {
      findOne: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (value) => value),
      count: jest.fn().mockResolvedValue(2),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    repository.manager = { ...manager, transaction: jest.fn((work) => work(manager)) };
    service = new PeopleService(repository as never);
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

  it('shows a person’s date with its year, or null for the year when it is not known', async () => {
    (repository.manager as { query: jest.Mock }).query.mockResolvedValue([
      { ...marieRow, dateKind: 'birthday', dateMonth: 3, dateDay: 14, dateYear: 1992 },
      { ...marieRow, id: 13, dateKind: 'anniversary', dateMonth: '2', dateDay: '29', dateYear: null },
    ]);

    const { people } = await service.list(7);
    expect(people.map((person) => person.date)).toEqual([
      { kind: 'birthday', month: 3, day: 14, year: 1992 },
      { kind: 'anniversary', month: 2, day: 29, year: null },
    ]);
  });

  it('renames only the writer’s own person, keeping their date when none is sent', async () => {
    repository.findOne.mockResolvedValueOnce({ id: 12, userId: 7, name: 'Marie', ...noDate, dateKind: 'birthday', dateMonth: 3, dateDay: 14 }).mockResolvedValueOnce(null);

    await expect(service.update(7, 12, { name: 'Marie Curie' })).resolves.toEqual(marie);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 12, userId: 7 } });
    expect(repository.save).toHaveBeenCalledWith({ id: 12, userId: 7, name: 'Marie Curie', ...noDate, dateKind: 'birthday', dateMonth: 3, dateDay: 14 });
    await expectApiError(service.update(8, 12, { name: 'Mine' }), NotFoundException, 'PERSON_NOT_FOUND');
  });

  it('sets a birthday or an anniversary with or without its year, and removes it with null', async () => {
    const now = new Date('2026-11-01T12:00:00Z');
    repository.findOne.mockImplementation(async () => ({ id: 12, userId: 7, name: 'Marie', ...noDate }));

    await service.update(7, 12, { name: 'Marie', date: { kind: 'birthday', month: 3, day: 14, year: 1992 } }, now);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ dateKind: 'birthday', dateMonth: 3, dateDay: 14, dateYear: 1992 }));
    await service.update(7, 12, { name: 'Marie', date: { kind: 'anniversary', month: 2, day: 29 } }, now);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ dateKind: 'anniversary', dateMonth: 2, dateDay: 29, dateYear: null }));
    await service.update(7, 12, { name: 'Marie', date: null }, now);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining(noDate));
  });

  it('refuses a date that cannot be, with its own code, and saves nothing', async () => {
    const now = new Date('2026-11-01T12:00:00Z');
    repository.findOne.mockImplementation(async () => ({ id: 12, userId: 7, name: 'Marie', ...noDate }));
    const update = (date: { month: number; day: number; year?: number | null }) => service.update(7, 12, { name: 'Marie', date: { kind: 'birthday', ...date } }, now);

    await expectApiError(update({ month: 4, day: 31 }), BadRequestException, 'PERSON_DATE_INVALID');
    await expectApiError(update({ month: 2, day: 29, year: 2023 }), BadRequestException, 'PERSON_DATE_INVALID');
    await expectApiError(update({ month: 3, day: 14, year: 92 }), BadRequestException, 'PERSON_DATE_YEAR_INVALID');
    await expectApiError(update({ month: 11, day: 3, year: 2026 }), BadRequestException, 'PERSON_DATE_IN_FUTURE');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('shows a person’s reach-out reminder and last contact, reading a reminder sent back as text as a number', async () => {
    (repository.manager as { query: jest.Mock }).query.mockResolvedValue([{ ...marieRow, reachOutDays: '30', lastContactOn: '2026-11-03' }]);

    const { people } = await service.list(7);
    expect(people.map(({ reachOutDays, lastContactOn }) => ({ reachOutDays, lastContactOn }))).toEqual([{ reachOutDays: 30, lastContactOn: '2026-11-03' }]);
    expect((repository.manager as { query: jest.Mock }).query.mock.calls[0][0]).toContain(`to_char(p.last_contact_on, 'YYYY-MM-DD') AS "lastContactOn"`);
  });

  it('sets the reach-out reminder and the last contact when sent, keeps them when left out and removes them with null', async () => {
    const now = new Date('2026-11-22T12:00:00Z');
    repository.findOne.mockImplementation(async () => ({ id: 12, userId: 7, name: 'Marie', ...noDate, reachOutDays: 90, lastContactOn: '2026-10-01' }));

    await service.update(7, 12, { name: 'Marie' }, now);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ reachOutDays: 90, lastContactOn: '2026-10-01' }));
    await service.update(7, 12, { name: 'Marie', reachOutDays: 30, lastContactOn: '2026-11-23' }, now);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ reachOutDays: 30, lastContactOn: '2026-11-23' }));
    await service.update(7, 12, { name: 'Marie', reachOutDays: null, lastContactOn: null }, now);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining(noReachOut));
  });

  it('shows the writer’s notes on a person, sets them when sent, keeps them when left out and removes them with null', async () => {
    (repository.manager as { query: jest.Mock }).query.mockResolvedValue([{ ...marieRow, notes: 'Loves Japanese novels.' }]);
    repository.findOne.mockImplementation(async () => ({ id: 12, userId: 7, name: 'Marie', ...noDate, notes: 'Met at the gym.' }));

    expect((await service.list(7)).people[0].notes).toBe('Loves Japanese novels.');
    expect((repository.manager as { query: jest.Mock }).query.mock.calls[0][0]).toContain('p.notes');
    await service.update(7, 12, { name: 'Marie' });
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ notes: 'Met at the gym.' }));
    await service.update(7, 12, { name: 'Marie', notes: 'Loves Japanese novels.' });
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ notes: 'Loves Japanese novels.' }));
    await service.update(7, 12, { name: 'Marie', notes: null });
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ notes: null }));
  });

  it('shows a person’s groups and sets them when sent, once each and spelled as on the writer’s other people', async () => {
    (repository.manager as { query: jest.Mock }).query.mockResolvedValue([{ ...marieRow, groups: ['Friends', 'Climbing'] }]);
    repository.findOne.mockImplementation(async () => ({ id: 12, userId: 7, name: 'Marie', ...noDate, groups: ['Work'] }));
    repository.query.mockResolvedValue([{ name: 'Climbing' }, { name: 'Friends' }]);

    expect((await service.list(7)).people[0].groups).toEqual(['Friends', 'Climbing']);
    expect((repository.manager as { query: jest.Mock }).query.mock.calls[0][0]).toContain('p.groups');
    await service.update(7, 12, { name: 'Marie' });
    expect(repository.query).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ groups: ['Work'] }));
    await service.update(7, 12, { name: 'Marie', groups: ['friends', 'Neighbours', 'FRIENDS', 'climbing'] });
    expect(repository.query).toHaveBeenCalledWith(expect.stringContaining('unnest(p.groups) AS g WHERE p.user_id = $1 AND p.id <> $2'), [7, 12]);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ groups: ['Friends', 'Neighbours', 'Climbing'] }));
    await service.update(7, 12, { name: 'Marie', groups: [] });
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ groups: [] }));
  });

  it('refuses a last contact on a day still to come everywhere on Earth, and saves nothing', async () => {
    repository.findOne.mockImplementation(async () => ({ id: 12, userId: 7, name: 'Marie', ...noDate, ...noReachOut }));

    await expectApiError(
      service.update(7, 12, { name: 'Marie', lastContactOn: '2026-11-24' }, new Date('2026-11-22T12:00:00Z')),
      BadRequestException,
      'PERSON_CONTACT_IN_FUTURE',
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('records the writer’s day as the last contact with their own person only', async () => {
    repository.findOne.mockResolvedValueOnce({ id: 12, userId: 7, name: 'Marie', ...noDate, reachOutDays: 30, lastContactOn: '2026-09-01' }).mockResolvedValueOnce(null);

    await expect(service.markContacted(7, 12, '2026-11-22')).resolves.toEqual(marie);
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({ id: 12, reachOutDays: 30, lastContactOn: '2026-11-22' }));
    await expectApiError(service.markContacted(8, 12, '2026-11-22'), NotFoundException, 'PERSON_NOT_FOUND');
  });

  it('merges a duplicate under the people lock: handles, entries and saved searches move, then it goes', async () => {
    await expect(service.merge(7, 12, { duplicateId: 14 })).resolves.toEqual(marie);

    const statements = manager.query.mock.calls.map(([sql, parameters]) => [String(sql).replace(/\s+/g, ' ').trim(), parameters]);
    expect(statements[0]).toEqual(['SELECT pg_advisory_xact_lock(hashtext($1), $2)', ['people', 7]]);
    expect(repository.count).toHaveBeenCalledWith({ where: { id: In([12, 14]), userId: 7 } });
    expect(statements[1]).toEqual(['UPDATE person_handles SET person_id = $1 WHERE person_id = $2', [12, 14]]);
    expect(statements[2]).toEqual([expect.stringContaining('p.date_month IS NULL AND d.date_month IS NOT NULL'), [12, 14]]);
    expect(statements[3]).toEqual([expect.stringContaining('reach_out_days = COALESCE(p.reach_out_days, d.reach_out_days)'), [12, 14]]);
    expect(statements[3][0]).toContain('last_contact_on = GREATEST(p.last_contact_on, d.last_contact_on)');
    expect(statements[3][0]).toContain("ELSE p.notes || E'\\n\\n' || d.notes END");
    expect(statements[3][0]).toContain('groups = p.groups || ARRAY( SELECT g FROM unnest(d.groups) WITH ORDINALITY AS dg(g, n)');
    expect(statements[3][0]).toContain('WHERE lower(g) <> ALL (SELECT lower(own) FROM unnest(p.groups) AS own) ORDER BY n)');
    expect(statements[4][0]).toContain('INSERT INTO entry_people (entry_id, person_id) SELECT entry_id, $1 FROM entry_people WHERE person_id = $2 ON CONFLICT DO NOTHING');
    expect(statements[5]).toEqual([expect.stringContaining("jsonb_set(filters, '{personId}', to_jsonb($2::int))"), [7, 12, '14']]);
    expect(manager.getRepository).toHaveBeenCalledWith(Person);
    expect(repository.delete).toHaveBeenCalledWith({ id: 14, userId: 7 });
    expect(repository.update).toHaveBeenCalledWith({ id: 12, userId: 7 }, { updatedAt: expect.any(Date) });
  });

  it('refuses to merge a person into themselves or with someone else’s person', async () => {
    await expectApiError(service.merge(7, 12, { duplicateId: 12 }), BadRequestException, 'PERSON_MERGE_SAME');

    repository.count.mockResolvedValue(1);
    await expectApiError(service.merge(7, 12, { duplicateId: 99 }), NotFoundException, 'PERSON_NOT_FOUND');
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes a person and widens the saved searches for them, or says they are not found', async () => {
    await expect(service.delete(7, 12)).resolves.toEqual({ success: true });
    expect(repository.delete).toHaveBeenCalledWith({ id: 12, userId: 7 });
    expect(manager.query).toHaveBeenLastCalledWith(expect.stringContaining("jsonb_set(filters, '{personId}', 'null'::jsonb)"), [7, '12']);

    repository.delete.mockResolvedValue({ affected: 0 });
    await expectApiError(service.delete(7, 99), NotFoundException, 'PERSON_NOT_FOUND');
  });
});
