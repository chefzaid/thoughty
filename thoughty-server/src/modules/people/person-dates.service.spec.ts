import { In } from 'typeorm';
import { PersonDatesService } from './person-dates.service';

describe('PersonDatesService', () => {
  const personRepository = { query: jest.fn() };
  const entryRepository = { find: jest.fn() };
  const service = new PersonDatesService(personRepository as never, entryRepository as never);
  const row = { id: 12, name: 'Marie', dateKind: 'birthday', dateMonth: 2, dateDay: 29, dateYear: 2000, entryCount: '2', latestEntryId: 21 };

  beforeEach(() => jest.clearAllMocks());

  it('finds the people of the day, 29 February on 28 February in a common year, with the newest entry about each', async () => {
    const latest = { id: 21, date: '2026-02-01' };
    personRepository.query.mockResolvedValue([row, { ...row, id: 13, name: 'Paul', dateKind: 'anniversary', dateDay: 28, dateYear: null, entryCount: 0, latestEntryId: null }]);
    entryRepository.find.mockResolvedValue([latest]);

    await expect(service.findOn(7, '2026-02-28')).resolves.toEqual([
      { id: 12, name: 'Marie', date: { kind: 'birthday', month: 2, day: 29, year: 2000 }, years: 26, entryCount: 2, latestEntry: latest },
      { id: 13, name: 'Paul', date: { kind: 'anniversary', month: 2, day: 28, year: null }, years: null, entryCount: 0, latestEntry: null },
    ]);
    const [sql, parameters] = personRepository.query.mock.calls[0];
    expect(parameters).toEqual([7, [2, 2], [28, 29]]);
    expect(sql).toContain('e.deleted_at IS NULL AND e.sealed_until IS NULL');
    expect(sql).toContain('(p.date_month, p.date_day) IN (SELECT * FROM unnest($2::int[], $3::int[]))');
    expect(entryRepository.find).toHaveBeenCalledWith({ where: { id: In([21]), userId: 7 }, relations: { diary: true } });
  });

  it('reads no entry when no one has a date that day, and drops an entry gone meanwhile', async () => {
    personRepository.query.mockResolvedValueOnce([]);
    await expect(service.findOn(7, '2026-03-14')).resolves.toEqual([]);
    expect(entryRepository.find).not.toHaveBeenCalled();
    expect(personRepository.query.mock.calls[0][1]).toEqual([7, [3], [14]]);

    personRepository.query.mockResolvedValueOnce([row]);
    entryRepository.find.mockResolvedValueOnce([]);
    await expect(service.findOn(7, '2028-02-29')).resolves.toEqual([expect.objectContaining({ id: 12, years: 28, latestEntry: null })]);
  });
});
