import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { buildTimeCapsuleBed } from '@/modules/time-capsules/time-capsules.integration.test-helpers';

/** Birthdays and anniversaries in Highlights, on the writer's own day, with the checks the database keeps. */
describePostgres('PostgreSQL birthdays and anniversaries', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let bed: ReturnType<typeof buildTimeCapsuleBed>;
  let writerId: number;
  let otherId: number;
  let workDiaryId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    bed = buildTimeCapsuleBed(dataSource);
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
  const setDate = async (name: string, date: { kind: 'birthday' | 'anniversary'; month: number; day: number; year?: number | null }, userId = writerId) =>
    bed.people.update(userId, (await personNamed(name, userId)).id, { name, date }, new Date('2026-10-31T10:30:00Z'));
  const peopleOn = async (today: string, diaryId?: number, userId = writerId) =>
    (await bed.journal.getHighlights(userId, { today, diaryId })).personDates.map((person) => ({
      name: person.name,
      kind: person.date.kind,
      years: person.years,
      entryCount: person.entryCount,
      latest: person.latestEntry?.content ?? null,
    }));

  it('shows the person of the writer’s day in Kiritimati and in Pago Pago around midnight, by name', async () => {
    await write('2025-06-01', 'Picnic with @Marie, @Paul and @Zoe.');
    await setDate('Marie', { kind: 'birthday', month: 11, day: 1, year: 1990 });
    await setDate('Paul', { kind: 'anniversary', month: 10, day: 30 });
    await setDate('Zoe', { kind: 'birthday', month: 11, day: 1 });
    // Someone else's person on the same day is never shown
    await write('2025-06-01', 'Met @Marie.', {}, otherId);
    await setDate('Marie', { kind: 'birthday', month: 11, day: 1 }, otherId);

    // 10:30 UTC on 31 October 2026: 00:30 on 1 November in Kiritimati (UTC+14), 23:30 on 30 October in Pago Pago (UTC-11)
    const picnic = 'Picnic with @Marie, @Paul and @Zoe.';
    await expect(peopleOn('2026-11-01')).resolves.toEqual([
      { name: 'Marie', kind: 'birthday', years: 36, entryCount: 1, latest: picnic },
      { name: 'Zoe', kind: 'birthday', years: null, entryCount: 1, latest: picnic },
    ]);
    await expect(peopleOn('2026-10-30')).resolves.toEqual([{ name: 'Paul', kind: 'anniversary', years: null, entryCount: 1, latest: picnic }]);
    await expect(peopleOn('2026-10-31')).resolves.toEqual([]);
    // New Year in Kiritimati counts the years from the writer's year
    await setDate('Paul', { kind: 'anniversary', month: 1, day: 1, year: 2016 });
    await expect(peopleOn('2027-01-01')).resolves.toEqual([expect.objectContaining({ name: 'Paul', years: 11 })]);
    await expect(peopleOn('2026-12-31')).resolves.toEqual([]);
  });

  it('shows 29 February on 28 February in a year without a 29th, and on the 29th in a leap year', async () => {
    await write('2025-06-01', 'Cake for @Leo and @Mia.');
    await setDate('Leo', { kind: 'birthday', month: 2, day: 29, year: 2000 });
    await setDate('Mia', { kind: 'birthday', month: 2, day: 28, year: 2001 });

    await expect(peopleOn('2027-02-28')).resolves.toEqual([
      expect.objectContaining({ name: 'Leo', years: 27 }),
      expect.objectContaining({ name: 'Mia', years: 26 }),
    ]);
    await expect(peopleOn('2027-03-01')).resolves.toEqual([]);
    await expect(peopleOn('2028-02-28')).resolves.toEqual([expect.objectContaining({ name: 'Mia', years: 27 })]);
    await expect(peopleOn('2028-02-29')).resolves.toEqual([expect.objectContaining({ name: 'Leo', years: 28 })]);
    // A leap day the year never had is refused, by the API and by the database
    await expectApiError(setDate('Mia', { kind: 'birthday', month: 2, day: 29, year: 2001 }), BadRequestException, 'PERSON_DATE_INVALID');
    await expect(dataSource.query(
      "UPDATE people SET date_kind = 'birthday', date_month = 2, date_day = 29, date_year = 2001 WHERE name = 'Mia'",
    )).rejects.toThrow(/chk_people_date_year/);
  });

  it('counts every diary but never the recycle bin or a sealed time capsule, and links the newest entry left', async () => {
    await write('2025-03-01', 'Lunch with @Marie.');
    await write('2025-05-01', 'Call with @Marie about work.', { diaryId: workDiaryId });
    const binned = await write('2025-09-01', 'Dinner with @Marie.');
    await bed.journal.delete(writerId, binned);
    await write('2025-10-01', 'Dear future me, @Marie says hello.', {
      seal: { opensOn: `${new Date().getFullYear() + 40}-01-01`, timeZone: 'Europe/Paris' },
    });
    const sealedId = (await dataSource.getRepository(Entry).findOneByOrFail({ userId: writerId, date: '2025-10-01' })).id;
    const marie = await setDate('Marie', { kind: 'birthday', month: 3, day: 14, year: 1992 });
    // Even a link a sealed entry kept would not count
    await dataSource.query('INSERT INTO entry_people (entry_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [sealedId, marie.id]);

    const expected = [{ name: 'Marie', kind: 'birthday', years: 34, entryCount: 2, latest: 'Call with @Marie about work.' }];
    await expect(peopleOn('2026-03-14')).resolves.toEqual(expected);
    // Highlights of one diary still show the person, counted over every diary as their view is
    await expect(peopleOn('2026-03-14', workDiaryId)).resolves.toEqual(expected);
    const [person] = (await bed.journal.getHighlights(writerId, { today: '2026-03-14' })).personDates;
    expect(person.latestEntry).toEqual(expect.objectContaining({ diary_name: 'Work', date: '2025-05-01' }));
  });

  it('shows a person no entry mentions any more with a count of 0 and no entry', async () => {
    const only = await write('2025-03-01', 'Lunch with @Marie.');
    await setDate('Marie', { kind: 'anniversary', month: 3, day: 14 });
    await bed.journal.delete(writerId, only);

    await expect(peopleOn('2026-03-14')).resolves.toEqual([{ name: 'Marie', kind: 'anniversary', years: null, entryCount: 0, latest: null }]);
  });

  it('keeps, replaces, removes and merges dates, refusing a year still to come anywhere on Earth', async () => {
    await write('2025-03-01', 'Lunch with @Marie and @MarieC.');
    const marie = await personNamed('Marie');
    await setDate('Marie', { kind: 'birthday', month: 11, day: 1, year: 2026 });
    // 10:30 UTC on 31 October 2026 is 1 November in Kiritimati, not yet the 2nd anywhere
    await expectApiError(setDate('Marie', { kind: 'birthday', month: 11, day: 2, year: 2026 }), BadRequestException, 'PERSON_DATE_IN_FUTURE');
    await expectApiError(setDate('Marie', { kind: 'birthday', month: 3, day: 14, year: 92 }), BadRequestException, 'PERSON_DATE_YEAR_INVALID');
    await expectApiError(setDate('Marie', { kind: 'birthday', month: 4, day: 31 }), BadRequestException, 'PERSON_DATE_INVALID');
    expect((await personNamed('Marie')).date).toEqual({ kind: 'birthday', month: 11, day: 1, year: 2026 });

    // Renaming without a date keeps it; null removes it
    await bed.people.update(writerId, marie.id, { name: 'Marie Curie' });
    expect((await personNamed('Marie Curie')).date).toEqual({ kind: 'birthday', month: 11, day: 1, year: 2026 });
    await bed.people.update(writerId, marie.id, { name: 'Marie Curie', date: null });
    expect((await personNamed('Marie Curie')).date).toBeNull();

    // The person kept takes the duplicate's date when they have none, and keeps their own otherwise
    await setDate('MarieC', { kind: 'anniversary', month: 6, day: 21, year: 2010 });
    const merged = await bed.people.merge(writerId, marie.id, { duplicateId: (await personNamed('MarieC')).id });
    expect(merged.date).toEqual({ kind: 'anniversary', month: 6, day: 21, year: 2010 });

    await expect(dataSource.query("UPDATE people SET date_kind = 'birthday', date_month = NULL WHERE id = $1", [marie.id]))
      .rejects.toThrow(/chk_people_date_complete/);
    await expect(dataSource.query('UPDATE people SET date_day = 31, date_month = 4 WHERE id = $1', [marie.id]))
      .rejects.toThrow(/chk_people_date_day/);
    await expect(dataSource.query("UPDATE people SET date_kind = 'nameday' WHERE id = $1", [marie.id]))
      .rejects.toThrow(/chk_people_date_kind/);
  });
});
