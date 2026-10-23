import { NotFoundException } from '@nestjs/common';
import { DataSource, type Repository } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Entry, EntryRevision, User } from '@/database/entities';
import { EntryTaskListService } from './entry-task-list.service';

describePostgres('PostgreSQL task list ticks', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let revisions: Repository<EntryRevision>;
  let tasks: EntryTaskListService;
  let userId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    revisions = dataSource.getRepository(EntryRevision);
    tasks = new EntryTaskListService(dataSource);
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    userId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' })).id;
  });

  const write = (content: string) =>
    entries.save({ userId, date: '2024-01-15', index: 1, tags: ['errands'], content, format: 'markdown' as const });

  it('applies ticks sent at the same time one after the other, and keeps one revision for the run', async () => {
    const entry = await write('- [ ] One\n- [ ] Two\n- [ ] Three');

    await Promise.all([
      tasks.setTask(userId, entry.id, { line: 0, checked: true }),
      tasks.setTask(userId, entry.id, { line: 1, checked: true }),
      tasks.setTask(userId, entry.id, { line: 2, checked: true }),
    ]);
    await tasks.setTask(userId, entry.id, { line: 1, checked: false });

    expect((await entries.findOneByOrFail({ id: entry.id })).content).toBe('- [x] One\n- [ ] Two\n- [x] Three');
    const history = await revisions.find({ where: { entryId: entry.id } });
    expect(history.map((revision) => revision.content)).toEqual(['- [ ] One\n- [ ] Two\n- [ ] Three']);
  });

  it('adds a revision again once the latest one is older than ten minutes', async () => {
    const entry = await write('- [ ] One\n- [ ] Two');
    await tasks.setTask(userId, entry.id, { line: 0, checked: true });
    await dataSource.query(`UPDATE entry_revisions SET created_at = now() - interval '11 minutes'`);

    await tasks.setTask(userId, entry.id, { line: 1, checked: true });

    const history = await revisions.find({ where: { entryId: entry.id }, order: { id: 'ASC' } });
    expect(history.map((revision) => revision.content)).toEqual(['- [ ] One\n- [ ] Two', '- [x] One\n- [ ] Two']);
  });

  it('leaves entries in the recycle bin alone', async () => {
    const entry = await write('- [ ] One');
    await entries.softDelete({ id: entry.id });

    await expect(tasks.setTask(userId, entry.id, { line: 0, checked: true })).rejects.toThrow(NotFoundException);
    expect((await entries.findOneOrFail({ where: { id: entry.id }, withDeleted: true })).content).toBe('- [ ] One');
  });
});
