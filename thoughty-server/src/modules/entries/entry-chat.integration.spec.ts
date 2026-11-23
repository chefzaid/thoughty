import { DataSource, type Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { Entry, LifeEra, User } from '@/database/entities';
import { MAX_ENTRIES_CHAT_ENTRIES } from '@/modules/ai';
import { EntryChatService } from './entry-chat.service';
import { EntrySearchService } from './entry-search.service';

describePostgres('PostgreSQL entries chat', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let chat: EntryChatService;
  const aiEntriesChat = { reply: jest.fn() };
  let userId: number;
  let otherUserId: number;
  const messages = [{ role: 'user' as const, content: 'What comes back?' }];

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    chat = new EntryChatService(entries, new EntrySearchService(entries), aiEntriesChat as never);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    userId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherUserId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    aiEntriesChat.reply.mockReset().mockResolvedValue('Walks come back [2].');
  });

  const write = (overrides: Partial<Entry>) =>
    entries.save({ userId, date: '2026-10-05', index: 1, tags: [], content: 'Text', ...overrides });

  it("reads the writer's matching entries oldest first, never a sealed, locked or binned one, nor another writer's", async () => {
    const walk = await write({ content: 'A walk', tags: ['walks'], date: '2026-10-01', title: 'Morning' });
    const hike = await write({ content: 'A hike', tags: ['walks'], date: '2026-10-02' });
    await write({ content: 'Groceries', tags: ['chores'], date: '2026-10-03' });
    await write({ content: 'Sealed walk', tags: ['walks'], date: '2026-10-04', sealedUntil: new Date('2040-01-01T00:00:00Z') });
    const locked = await write({ content: 'Locked walk', tags: ['walks'], date: '2026-10-05' });
    await dataSource.query('UPDATE entries SET is_locked = TRUE WHERE id = $1', [locked.id]);
    const binned = await write({ content: 'Binned walk', tags: ['walks'], date: '2026-10-06' });
    await entries.softDelete(binned.id);
    await write({ userId: otherUserId, content: 'Not mine', tags: ['walks'] });

    await expect(chat.chat(userId, { tags: 'walks' }, { messages })).resolves.toEqual({
      reply: 'Walks come back [2].',
      entries: [
        { ref: 1, id: walk.id, date: '2026-10-01', title: 'Morning' },
        { ref: 2, id: hike.id, date: '2026-10-02', title: null },
      ],
      cited: [2],
      total: 2,
    });
    expect(aiEntriesChat.reply).toHaveBeenCalledWith(userId, [
      { date: '2026-10-01', title: 'Morning', text: 'A walk' },
      { date: '2026-10-02', title: null, text: 'A hike' },
    ], messages);
  });

  it('never reads an entry of a diary with AI off, nor counts it', async () => {
    const [open, closed] = await dataSource.query(
      `INSERT INTO diaries (user_id, name, ai_mode) VALUES ($1, 'Thoughts', 'on'), ($1, 'Health', 'off') RETURNING id`,
      [userId],
    );
    const walk = await write({ content: 'A walk', tags: ['walks'], diaryId: open.id });
    await write({ content: 'A walk to the clinic', tags: ['walks'], diaryId: closed.id });

    await expect(chat.chat(userId, { tags: 'walks' }, { messages })).resolves.toMatchObject({
      entries: [{ ref: 1, id: walk.id }],
      total: 1,
    });
    await expectApiError(chat.chat(userId, { tags: 'walks', diaryId: closed.id }, { messages }), NotFoundException, 'ENTRY_CHAT_NO_MATCH');
  });

  it('narrows to a date range and a life era, as the journal filters do', async () => {
    const era = await dataSource.getRepository(LifeEra).save({ userId, name: 'Autumn', startDate: '2026-09-01', endDate: '2026-10-31' });
    await write({ content: 'Summer', date: '2026-08-15' });
    const early = await write({ content: 'Early autumn', date: '2026-09-10' });
    await write({ content: 'Late autumn', date: '2026-10-20' });

    const { entries: read, total } = await chat.chat(userId, { eraId: era.id, dateTo: '2026-09-30' }, { messages });
    expect(read.map((entry) => entry.id)).toEqual([early.id]);
    expect(total).toBe(1);
  });

  it('reads the newest fifty and counts every match', async () => {
    for (let index = 1; index <= MAX_ENTRIES_CHAT_ENTRIES + 2; index += 1) {
      await write({ content: `Day ${index}`, date: `2026-0${1 + Math.floor((index - 1) / 28)}-${String(1 + ((index - 1) % 28)).padStart(2, '0')}` });
    }

    const { entries: read, total } = await chat.chat(userId, {}, { messages });
    expect(total).toBe(MAX_ENTRIES_CHAT_ENTRIES + 2);
    expect(read).toHaveLength(MAX_ENTRIES_CHAT_ENTRIES);
    expect(read[0].date).toBe('2026-01-03');
    expect(read.at(-1)?.date).toBe('2026-02-24');
  });

  it('answers 404 with a code when no entry matches', async () => {
    await write({ content: 'A walk', date: '2026-10-01' });

    await expectApiError(chat.chat(userId, { dateFrom: '2026-11-01' }, { messages }), NotFoundException, 'ENTRY_CHAT_NO_MATCH');
    expect(aiEntriesChat.reply).not.toHaveBeenCalled();
  });
});
