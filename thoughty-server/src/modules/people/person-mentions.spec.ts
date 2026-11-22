import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { GroupMentionsQueryDto, PersonMentionsQueryDto } from './dto';
import { PERSON_GROUP_NAME_MAX_LENGTH } from './person-groups';
import { mentionsOverTime, PERSON_MENTION_MONTHS } from './person-mentions';
import { PersonMentionsService } from './person-mentions.service';

describe('mentionsOverTime', () => {
  const row = (month: string, entries: number, moodEntries = 0, moodSum: number | null = null) => ({ month, entries, moodEntries, moodSum });

  it('lists the twelve months ending with the writer’s month across a new year, months without a mention at 0', () => {
    const result = mentionsOverTime([row('2025-12', 2, 2, 9), row('2026-02', '3' as never, '1' as never, '2' as never)], '2026-03-05');

    expect(result.months).toHaveLength(PERSON_MENTION_MONTHS);
    expect(result.months[0].period).toBe('2025-04');
    expect(result.months.at(-1)).toEqual({ period: '2026-03', entries: 0, moodEntries: 0, averageMood: null });
    expect(result.months.find(({ period }) => period === '2025-12')).toEqual({ period: '2025-12', entries: 2, moodEntries: 2, averageMood: 4.5 });
    expect(result.months.find(({ period }) => period === '2026-02')).toEqual({ period: '2026-02', entries: 3, moodEntries: 1, averageMood: 2 });
    expect(result.months.find(({ period }) => period === '2026-01')).toEqual({ period: '2026-01', entries: 0, moodEntries: 0, averageMood: null });
  });

  it('adds up every year from the first mention to the writer’s year, older months included', () => {
    const result = mentionsOverTime([row('2022-05', 1, 1, 5), row('2024-01', 2), row('2024-11', 1, 1, 2), row('2026-12', 4, 2, 7)], '2026-12-31');

    expect(result.entries).toBe(8);
    expect(result.years).toEqual([
      { period: '2022', entries: 1, moodEntries: 1, averageMood: 5 },
      { period: '2023', entries: 0, moodEntries: 0, averageMood: null },
      { period: '2024', entries: 3, moodEntries: 1, averageMood: 2 },
      { period: '2025', entries: 0, moodEntries: 0, averageMood: null },
      { period: '2026', entries: 4, moodEntries: 2, averageMood: 3.5 },
    ]);
    expect(result.months.map(({ period }) => period)).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ]);
  });

  it('has no years and empty months without a mention', () => {
    const result = mentionsOverTime([], '2026-11-22');

    expect(result).toEqual({ entries: 0, years: [], months: expect.any(Array) });
    expect(result.months.every(({ entries }) => entries === 0)).toBe(true);
  });
});

describe('mentions query DTOs', () => {
  it('takes an optional writer’s day', async () => {
    await expect(invalidPropertiesLikeApi(PersonMentionsQueryDto, {})).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(PersonMentionsQueryDto, { today: new Date().toISOString().slice(0, 10) })).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(PersonMentionsQueryDto, { today: '2020-01-01' })).resolves.toEqual(['today']);
    await expect(invalidPropertiesLikeApi(PersonMentionsQueryDto, { today: 'soon' })).resolves.toEqual(['today']);
  });

  it('takes a trimmed group name of 1 to 40 characters', async () => {
    const group = (value: unknown) => invalidPropertiesLikeApi(GroupMentionsQueryDto, value === undefined ? {} : { group: value });

    await expect(parseLikeApi(GroupMentionsQueryDto, { group: '  Friends ' })).resolves.toMatchObject({ group: 'Friends' });
    await expect(group('g'.repeat(PERSON_GROUP_NAME_MAX_LENGTH))).resolves.toEqual([]);
    await expect(group(undefined)).resolves.toEqual(['group']);
    await expect(group('   ')).resolves.toEqual(['group']);
    await expect(group('g'.repeat(PERSON_GROUP_NAME_MAX_LENGTH + 1))).resolves.toEqual(['group']);
    await expect(group(['Friends', 'Family'])).resolves.toEqual(['group']);
  });
});

describe('PersonMentionsService', () => {
  const repository = { exists: jest.fn(), find: jest.fn(), query: jest.fn() };
  const service = new PersonMentionsService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it('refuses someone else’s person or one that is gone', async () => {
    repository.exists.mockResolvedValue(false);

    await expect(service.forPerson(7, 12, '2026-11-22')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'PERSON_NOT_FOUND' }) });
    expect(repository.exists).toHaveBeenCalledWith({ where: { id: 12, userId: 7 } });
    expect(repository.query).not.toHaveBeenCalled();
  });

  it('counts the entries of the person, or of everyone in the group ignoring case, without asking for an empty group', async () => {
    repository.exists.mockResolvedValue(true);
    repository.query.mockResolvedValue([{ month: '2026-11', entries: 2, moodEntries: 1, moodSum: 4 }]);
    repository.find.mockResolvedValue([{ id: 1, groups: ['Friends'] }, { id: 2, groups: ['Work'] }, { id: 3, groups: ['FRIENDS', 'Work'] }]);

    await expect(service.forPerson(7, 12, '2026-11-22')).resolves.toMatchObject({ entries: 2 });
    expect(repository.query).toHaveBeenLastCalledWith(expect.stringContaining('ANY($3::int[])'), [7, '2026-11-22', [12]]);

    await expect(service.forGroup(7, 'friends', '2026-11-22')).resolves.toMatchObject({ entries: 2 });
    expect(repository.query).toHaveBeenLastCalledWith(expect.any(String), [7, '2026-11-22', [1, 3]]);

    repository.query.mockClear();
    await expect(service.forGroup(7, 'Climbing', '2026-11-22')).resolves.toMatchObject({ entries: 0, years: [] });
    expect(repository.query).not.toHaveBeenCalled();
  });
});
