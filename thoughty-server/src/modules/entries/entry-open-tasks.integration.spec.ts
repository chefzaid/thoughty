import type { DataSource, Repository } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, EntryRevision, User } from '@/database/entities';
import { buildTimeCapsuleBed } from '@/modules/time-capsules/time-capsules.integration.test-helpers';
import { EntryOpenTasksService, OPEN_TASKS_BATCH_SIZE } from './entry-open-tasks.service';

describePostgres('PostgreSQL open tasks across the journal', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let bed: ReturnType<typeof buildTimeCapsuleBed>;
  let openTasks: EntryOpenTasksService;
  let writerId: number;
  let otherId: number;
  let homeId: number;
  let workId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    bed = buildTimeCapsuleBed(dataSource);
    openTasks = new EntryOpenTasksService(entries);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    const diaries = dataSource.getRepository(Diary);
    homeId = (await diaries.save({ userId: writerId, name: 'Home', isDefault: true, position: 0 })).id;
    workId = (await diaries.save({ userId: writerId, name: 'Work', isDefault: false, position: 1 })).id;
  });

  const write = (content: string, overrides: Partial<Entry> = {}) =>
    entries.save({ userId: writerId, diaryId: homeId, date: '2026-10-01', index: 1, tags: [], content, format: 'markdown' as const, ...overrides });
  const texts = async (query = {}) => (await openTasks.list(writerId, query)).tasks.map((task) => task.text);

  it("lists the writer's unticked tasks, newest entries first, leaving out code, plain text and other writers", async () => {
    await write('- [ ] Older task', { date: '2026-09-01' });
    const errands = await write(['# Errands', '- [ ] Call the bank', '- [x] Post the letter', '```', '- [ ] Code', '```', '  * [ ] Nested'].join('\n'), {
      date: '2026-10-21',
      title: 'Errands',
    });
    await write('1. [ ] Later the same day', { date: '2026-10-21', index: 2 });
    await write('- [ ] Plain text entry', { format: 'plain', date: '2026-10-30' });
    await entries.save({ userId: otherId, date: '2026-10-30', index: 1, tags: [], content: '- [ ] Not mine', format: 'markdown' });

    const result = await openTasks.list(writerId, {});

    expect(result.tasks).toEqual([
      { entryId: errands.id, date: '2026-10-21', title: 'Errands', line: 1, text: 'Call the bank' },
      { entryId: errands.id, date: '2026-10-21', title: 'Errands', line: 6, text: 'Nested' },
      expect.objectContaining({ date: '2026-10-21', line: 0, text: 'Later the same day' }),
      expect.objectContaining({ date: '2026-09-01', text: 'Older task' }),
    ]);
    expect(result).toMatchObject({ total: 4, page: 1, totalPages: 1 });
  });

  it('narrows to a diary, keeps archived entries, and leaves out the recycle bin and sealed time capsules', async () => {
    await write('- [ ] At home');
    await write('- [ ] At work', { diaryId: workId });
    await write('- [ ] Archived but still to do', { isArchived: true, date: '2026-09-01' });
    const deleted = await write('- [ ] In the recycle bin');
    await entries.softDelete({ id: deleted.id });
    await bed.journal.create(writerId, {
      text: '- [ ] Hidden in a capsule',
      tags: [],
      date: '2026-10-02',
      format: 'markdown',
      seal: { opensOn: `${new Date().getFullYear() + 5}-01-01`, timeZone: 'Europe/Paris' },
    });

    expect(await texts()).toEqual(['At home', 'At work', 'Archived but still to do']);
    expect(await texts({ diaryId: workId })).toEqual(['At work']);
    expect(await texts({ diaryId: homeId })).toEqual(['At home', 'Archived but still to do']);
    expect(JSON.stringify(await openTasks.list(writerId, {}))).not.toContain('capsule');
  });

  it('pages through more tasks than one batch of entries holds', async () => {
    const count = OPEN_TASKS_BATCH_SIZE + 5;
    await dataSource.query(
      `INSERT INTO entries (user_id, diary_id, date, index, tags, content, format)
       SELECT $1, $2, DATE '2020-01-01' + n, 1, '{}', '- [ ] Task ' || n, 'markdown' FROM generate_series(1, $3) AS n`,
      [writerId, homeId, count],
    );

    const last = await openTasks.list(writerId, { page: 3, limit: 100 });

    expect(last).toMatchObject({ total: count, page: 3, totalPages: 3 });
    expect(last.tasks.map((task) => task.text)).toEqual(['Task 5', 'Task 4', 'Task 3', 'Task 2', 'Task 1']);
  });

  it('starts the next page right after the last task read, whatever was ticked on the page before', async () => {
    await write('- [ ] Oldest', { date: '2026-09-01' });
    await write('- [ ] Five\n- [ ] Six', { date: '2026-10-01', timeOfDay: '18:00' });
    const morning = await write('- [ ] Three\n- [ ] Four', { date: '2026-10-01', timeOfDay: '08:00' });
    await write('- [ ] One\n- [ ] Two', { date: '2026-10-02' });
    const first = await openTasks.list(writerId, { limit: 4 });
    expect(first.tasks.map((task) => task.text)).toEqual(['One', 'Two', 'Three', 'Four']);

    // Both tasks of the page's last entry and one more are ticked: that entry drops out of the list
    for (const task of first.tasks.slice(1)) {
      await bed.journal.setTask(writerId, task.entryId, { line: task.line, checked: true, text: task.text });
    }
    expect((await entries.findOneByOrFail({ id: morning.id })).content).toBe('- [x] Three\n- [x] Four');
    expect((await openTasks.list(writerId, { page: 2, limit: 4 })).tasks).toEqual([]);

    const next = await openTasks.list(writerId, { after: first.nextCursor!, limit: 4 });

    expect(next.tasks.map((task) => task.text)).toEqual(['Five', 'Six', 'Oldest']);
    expect(next).toMatchObject({ total: 4, page: 2, totalPages: 2, nextCursor: null });
    expect(first.nextCursor).toBe(`2026-10-01_08:00_1_${morning.id}_1`);
  });

  it('ticks a task from the list through the entry, with its history, and refuses a line that moved', async () => {
    const entry = await write('- [ ] One\n- [ ] Two');
    const [first] = (await openTasks.list(writerId, {})).tasks;

    await bed.journal.setTask(writerId, first.entryId, { line: first.line, checked: true, text: first.text });

    expect(await texts()).toEqual(['Two']);
    expect((await entries.findOneByOrFail({ id: entry.id })).content).toBe('- [x] One\n- [ ] Two');
    const history = await dataSource.getRepository(EntryRevision).find({ where: { entryId: entry.id } });
    expect(history.map((revision) => revision.content)).toEqual(['- [ ] One\n- [ ] Two']);

    // The entry gained a line on top since the list was read: line 1 is now "One", not "Two"
    const [second] = (await openTasks.list(writerId, {})).tasks;
    await entries.update({ id: entry.id }, { content: '- [ ] Zero\n- [x] One\n- [ ] Two' });
    await expect(bed.journal.setTask(writerId, entry.id, { line: second.line, checked: true, text: second.text }))
      .rejects.toMatchObject({ response: { code: 'ENTRY_TASK_STALE' } });
    expect((await entries.findOneByOrFail({ id: entry.id })).content).toBe('- [ ] Zero\n- [x] One\n- [ ] Two');
  });

  it('moves the journal list version on when a task is ticked, so cached lists are read afresh', async () => {
    const entry = await write('- [ ] One');
    const version = async () =>
      String((await dataSource.query('SELECT version FROM entry_list_versions WHERE user_id = $1', [writerId]))[0]?.version ?? '0');
    const before = await version();

    await bed.journal.setTask(writerId, entry.id, { line: 0, checked: true, text: 'One' });

    expect(await version()).not.toBe(before);
  });
});
