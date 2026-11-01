import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { DataSource, Repository } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { RereadReminderService } from './reread-reminders.service';

const NOW = new Date('2026-10-31T10:00:00Z');
const TODAY = '2026-10-31';

describePostgres('PostgreSQL reread reminders', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let reminders: RereadReminderService;
  let writerId: number;
  let otherId: number;
  let journal: Diary;
  let travel: Diary;

  const write = (content: string, fields: Partial<Entry> = {}) =>
    entries.save({ userId: writerId, diaryId: journal.id, date: '2025-04-01', content, tags: [], ...fields });
  const dueIds = async (diaryId?: number, today = TODAY) =>
    (await reminders.findDue(writerId, diaryId, today)).map((entry) => entry.id);

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    reminders = new RereadReminderService(entries);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    const diaries = dataSource.getRepository(Diary);
    journal = await diaries.save({ userId: writerId, name: 'Journal', isDefault: true, position: 0 });
    travel = await diaries.save({ userId: writerId, name: 'Travel', position: 1 });
  });

  it('keeps one reminder per entry, replaced by the next one and cleared when done', async () => {
    const entry = await write('The day we moved');

    await reminders.set(writerId, entry.id, '2026-11-07', TODAY, NOW);
    await reminders.set(writerId, entry.id, '2027-10-31', TODAY, NOW);
    expect((await entries.findOneByOrFail({ id: entry.id })).rereadOn).toBe('2027-10-31');

    await reminders.clear(writerId, entry.id);
    expect((await entries.findOneByOrFail({ id: entry.id })).rereadOn).toBeNull();
  });

  it('refuses a past day, another writer’s entry and a sealed time capsule, which the database refuses too', async () => {
    const entry = await write('Ordinary day');
    const capsule = await write('', { visibility: 'private', sealedUntil: new Date('2030-01-01T08:00:00Z') });

    await expectApiError(reminders.set(writerId, entry.id, TODAY, TODAY, NOW), BadRequestException, 'REREAD_DATE_INVALID');
    await expectApiError(reminders.set(otherId, entry.id, '2026-11-07', TODAY, NOW), NotFoundException, 'ENTRY_NOT_FOUND');
    await expectApiError(reminders.set(writerId, capsule.id, '2026-11-07', TODAY, NOW), ConflictException, 'ENTRY_SEALED');
    await expect(
      dataSource.query(`UPDATE entries SET reread_on = '2026-11-07' WHERE id = $1`, [capsule.id]),
    ).rejects.toThrow(/chk_entries_reread_open/);
  });

  it('finds the reminders due by the writer’s day, longest waiting first, in one diary or all', async () => {
    const older = await write('Asked long ago', { rereadOn: '2026-10-01' });
    const today = await write('Asked for today', { rereadOn: TODAY, diaryId: travel.id });
    await write('Asked for next week', { rereadOn: '2026-11-07' });
    await write('No reminder');
    await entries.save({ userId: otherId, date: '2025-04-01', content: 'Someone else’s', tags: [], rereadOn: '2026-10-01' });

    expect(await dueIds()).toEqual([older.id, today.id]);
    expect(await dueIds(travel.id)).toEqual([today.id]);
    // The day before, in a time zone still on yesterday, only the older one is due
    expect(await dueIds(undefined, '2026-10-30')).toEqual([older.id]);
  });

  it('keeps an entry’s reminder through the recycle bin, hidden there, and drops it with the entry', async () => {
    const entry = await write('Back from the bin', { rereadOn: '2026-10-20' });

    await entries.softDelete(entry.id);
    expect(await dueIds()).toEqual([]);
    await expectApiError(reminders.clear(writerId, entry.id), NotFoundException, 'ENTRY_NOT_FOUND');

    await entries.restore(entry.id);
    expect(await dueIds()).toEqual([entry.id]);

    await entries.delete(entry.id);
    expect(await dueIds()).toEqual([]);
  });
});
