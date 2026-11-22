import { NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, Person, User } from '@/database/entities';
import { buildTimeCapsuleBed } from '@/modules/time-capsules/time-capsules.integration.test-helpers';
import { PersonMentionsService } from './person-mentions.service';

/** How often entries mention a person or a group, month by month and year by year, with their moods. */
describePostgres('PostgreSQL mentions over time', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let bed: ReturnType<typeof buildTimeCapsuleBed>;
  let mentions: PersonMentionsService;
  let writerId: number;
  let otherId: number;
  let workDiaryId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    bed = buildTimeCapsuleBed(dataSource);
    mentions = new PersonMentionsService(dataSource.getRepository(Person));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    for (const userId of [writerId, otherId]) {
      await dataSource.getRepository(Diary).save({ userId, name: 'Home', isDefault: true, position: 0 });
    }
    workDiaryId = (await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Work', isDefault: false, position: 1 })).id;
  });

  const write = async (date: string, text: string, extra: Record<string, unknown> = {}, userId = writerId) =>
    (await bed.journal.create(userId, { date, text, tags: [], ...extra })).entryId;
  const personNamed = async (name: string, userId = writerId) =>
    (await bed.people.list(userId)).people.find((person) => person.name === name)!;
  const group = async (name: string, groups: string[]) => bed.people.update(writerId, (await personNamed(name)).id, { name, groups });
  const nonZero = (periods: Array<{ period: string; entries: number; averageMood: number | null }>) =>
    periods.filter(({ entries }) => entries > 0).map(({ period, entries, averageMood }) => ({ period, entries, averageMood }));

  it('counts a person’s entries in every diary by month and year with their moods, up to the writer’s day', async () => {
    await write('2024-06-02', 'Hike with @Marie.', { mood: 5 });
    await write('2026-03-10', 'Coffee with @Marie.', { mood: 4 });
    await write('2026-03-20', '@Marie at work.', { diaryId: workDiaryId, mood: 2 });
    await write('2026-03-21', 'Another with @Marie, no mood.');
    await write('2026-12-01', 'Planned dinner with @Marie.');
    await write('2026-03-01', 'Someone else’s @Marie.', { mood: 1 }, otherId);
    const marie = await personNamed('Marie');

    const result = await mentions.forPerson(writerId, marie.id, '2026-11-22');
    expect(result.entries).toBe(4);
    expect(result.months.map(({ period }) => period)).toEqual(expect.arrayContaining(['2025-12', '2026-11']));
    expect(result.months).toHaveLength(12);
    expect(nonZero(result.months)).toEqual([{ period: '2026-03', entries: 3, averageMood: 3 }]);
    expect(result.years.map(({ period, entries, averageMood }) => ({ period, entries, averageMood }))).toEqual([
      { period: '2024', entries: 1, averageMood: 5 },
      { period: '2025', entries: 0, averageMood: null },
      { period: '2026', entries: 3, averageMood: 3 },
    ]);
    await expectApiError(mentions.forPerson(otherId, marie.id, '2026-11-22'), NotFoundException, 'PERSON_NOT_FOUND');
  });

  it('leaves out the recycle bin, sealed time capsules and locked entries', async () => {
    const binned = await write('2026-10-01', 'Dinner with @Leo.', { mood: 1 });
    await write('2026-10-02', 'Walk with @Leo.', { mood: 4 });
    const locked = await write('2026-10-03', 'Secret about @Leo.', { mood: 2 });
    await write('2026-10-04', 'Dear future me, @Leo says hello.', {
      seal: { opensOn: `${new Date().getFullYear() + 40}-01-01`, timeZone: 'Europe/Paris' },
    });
    const leo = await personNamed('Leo');
    const sealedId = (await dataSource.getRepository(Entry).findOneByOrFail({ userId: writerId, date: '2026-10-04' })).id;
    await dataSource.query('INSERT INTO entry_people (entry_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [sealedId, leo.id]);
    await dataSource.query('UPDATE entries SET is_locked = TRUE WHERE id = $1', [locked]);
    await bed.journal.delete(writerId, binned);

    const result = await mentions.forPerson(writerId, leo.id, '2026-11-22');
    expect(nonZero(result.months)).toEqual([{ period: '2026-10', entries: 1, averageMood: 4 }]);
    expect(result.entries).toBe(1);
  });

  it('counts an entry once for a group however many of its people it mentions, ignoring the group’s letter case', async () => {
    await write('2026-09-05', 'Picnic with @Ana and @Ben.', { mood: 5 });
    await write('2026-09-06', 'Call with @Ana.', { mood: 3 });
    await write('2026-10-01', 'Met @Cleo.', { mood: 1 });
    await group('Ana', ['Friends']);
    await group('Ben', ['friends', 'Climbing']);
    await group('Cleo', ['Work']);

    const friends = await mentions.forGroup(writerId, 'FRIENDS', '2026-11-22');
    expect(friends.entries).toBe(2);
    expect(nonZero(friends.months)).toEqual([{ period: '2026-09', entries: 2, averageMood: 4 }]);
    await expect(mentions.forGroup(writerId, 'Family', '2026-11-22')).resolves.toMatchObject({ entries: 0, years: [] });
    await expect(mentions.forGroup(otherId, 'Friends', '2026-11-22')).resolves.toMatchObject({ entries: 0, years: [] });
  });
});
