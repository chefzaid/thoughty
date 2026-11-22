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

/** Reach-out reminders in Highlights, on the writer's own day, with the last contact and the checks the database keeps. */
describePostgres('PostgreSQL reach-out reminders', () => {
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

  const now = new Date('2026-11-22T10:30:00Z');
  const write = async (date: string, text: string, extra: Record<string, unknown> = {}, userId = writerId) =>
    (await bed.journal.create(userId, { date, text, tags: [], ...extra })).entryId;
  const personNamed = async (name: string, userId = writerId) =>
    (await bed.people.list(userId)).people.find((person) => person.name === name)!;
  const remind = async (name: string, reachOutDays: number | null, lastContactOn?: string | null, userId = writerId) =>
    bed.people.update(userId, (await personNamed(name, userId)).id, { name, reachOutDays, lastContactOn }, now);
  const dueOn = async (today: string, diaryId?: number, userId = writerId) =>
    (await bed.journal.getHighlights(userId, { today, diaryId })).reachOuts.map(({ name, daysSince, lastContactOn, lastMentionedOn }) => ({
      name, daysSince, lastContactOn, lastMentionedOn,
    }));

  it('shows a person once the reminder’s days have passed since the later of the last contact and the newest mention', async () => {
    await write('2026-10-01', 'Coffee with @Marie and @Paul.');
    await write('2026-10-20', 'Paul called, @Paul sounds well.', { diaryId: workDiaryId });
    await remind('Marie', 30);
    await remind('Paul', 30, '2026-09-01');
    // Someone else's person with a reminder is never shown
    await write('2026-01-01', 'Met @Marie.', {}, otherId);
    await remind('Marie', 14, null, otherId);

    await expect(dueOn('2026-10-30')).resolves.toEqual([]);
    await expect(dueOn('2026-10-31')).resolves.toEqual([{ name: 'Marie', daysSince: 30, lastContactOn: null, lastMentionedOn: '2026-10-01' }]);
    // The mention in the Work diary is newer than Paul's last contact; Highlights of another diary still count it
    await expect(dueOn('2026-11-19', workDiaryId)).resolves.toEqual([
      { name: 'Marie', daysSince: 49, lastContactOn: null, lastMentionedOn: '2026-10-01' },
      { name: 'Paul', daysSince: 30, lastContactOn: '2026-09-01', lastMentionedOn: '2026-10-20' },
    ]);
    // A contact newer than the mention resets the count
    await bed.people.markContacted(writerId, (await personNamed('Marie')).id, '2026-11-19');
    await expect(dueOn('2026-11-19')).resolves.toEqual([expect.objectContaining({ name: 'Paul' })]);
    await expect(dueOn('2026-12-19')).resolves.toEqual([
      expect.objectContaining({ name: 'Paul', daysSince: 60 }),
      { name: 'Marie', daysSince: 30, lastContactOn: '2026-11-19', lastMentionedOn: '2026-10-01' },
    ]);
    // Turning the reminder off takes them out
    await remind('Paul', null);
    await expect(dueOn('2026-12-19')).resolves.toEqual([expect.objectContaining({ name: 'Marie' })]);
  });

  it('shows at once someone with neither a contact nor a mention left, never counting the recycle bin or a sealed capsule', async () => {
    const binned = await write('2026-11-10', 'Dinner with @Leo and @Mia.');
    await write('2026-11-12', 'Dear future me, @Leo says hello.', {
      seal: { opensOn: `${new Date().getFullYear() + 40}-01-01`, timeZone: 'Europe/Paris' },
    });
    const sealedId = (await dataSource.getRepository(Entry).findOneByOrFail({ userId: writerId, date: '2026-11-12' })).id;
    const leo = await remind('Leo', 14);
    await remind('Mia', 365, '2026-11-01');
    await dataSource.query('INSERT INTO entry_people (entry_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [sealedId, leo.id]);
    await expect(dueOn('2026-11-20')).resolves.toEqual([]);

    await bed.journal.delete(writerId, binned);
    await expect(dueOn('2026-11-20')).resolves.toEqual([{ name: 'Leo', daysSince: null, lastContactOn: null, lastMentionedOn: null }]);
  });

  it('lists the ten longest out of touch, those with nothing on record first', async () => {
    for (let index = 0; index < 12; index += 1) {
      await write(`2026-01-${String(index + 1).padStart(2, '0')}`, `Met @P${String(index).padStart(2, '0')}.`);
      await remind(`P${String(index).padStart(2, '0')}`, 14);
    }
    await remind('P11', 14, null);
    await dataSource.query('DELETE FROM entry_people WHERE person_id = $1', [(await personNamed('P11')).id]);

    const due = await dueOn('2026-11-22');
    expect(due.map(({ name }) => name)).toEqual(['P11', 'P00', 'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08']);
  });

  it('keeps, replaces, removes and merges the reminder and the last contact, refusing a contact still to come', async () => {
    await write('2026-10-01', 'Lunch with @Marie and @MarieC.');
    const marie = await remind('Marie', 90, '2026-10-05');
    expect(marie).toEqual(expect.objectContaining({ reachOutDays: 90, lastContactOn: '2026-10-05' }));
    // 10:30 UTC on 22 November is the 23rd in Kiritimati, not yet the 24th anywhere
    await expect(remind('Marie', 90, '2026-11-23')).resolves.toEqual(expect.objectContaining({ lastContactOn: '2026-11-23' }));
    await expectApiError(remind('Marie', 90, '2026-11-24'), BadRequestException, 'PERSON_CONTACT_IN_FUTURE');
    await bed.people.update(writerId, marie.id, { name: 'Marie Curie' });
    expect(await personNamed('Marie Curie')).toEqual(expect.objectContaining({ reachOutDays: 90, lastContactOn: '2026-11-23' }));
    await bed.people.update(writerId, marie.id, { name: 'Marie Curie', reachOutDays: null, lastContactOn: '2026-10-05' });

    // The person kept takes the duplicate's reminder when they have none, and the later of the two contacts
    await remind('MarieC', 30, '2026-11-01');
    const merged = await bed.people.merge(writerId, marie.id, { duplicateId: (await personNamed('MarieC')).id });
    expect(merged).toEqual(expect.objectContaining({ reachOutDays: 30, lastContactOn: '2026-11-01' }));

    await expect(dataSource.query('UPDATE people SET reach_out_days = 0 WHERE id = $1', [marie.id])).rejects.toThrow(/chk_people_reach_out_days/);
    await expect(dataSource.query('UPDATE people SET reach_out_days = 367 WHERE id = $1', [marie.id])).rejects.toThrow(/chk_people_reach_out_days/);
  });
});
