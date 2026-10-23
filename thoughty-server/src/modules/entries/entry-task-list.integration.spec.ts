import { join } from 'node:path';
import { NotFoundException } from '@nestjs/common';
import { DataSource, type Repository } from 'typeorm';
import { Entry, EntryRevision, User } from '@/database/entities';
import { EntryTaskListService } from './entry-task-list.service';

const url = process.env.THOUGHTY_PG_TEST_URL;
if (url && (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || new URL(url).pathname !== '/thoughty_ha_test')) {
  throw new Error('Use the isolated thoughty_ha_test localhost fixture');
}
const integration = url ? describe : describe.skip;

integration('PostgreSQL task list ticks', () => {
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let revisions: Repository<EntryRevision>;
  let tasks: EntryTaskListService;
  let userId: number;

  beforeAll(async () => {
    dataSource = await new DataSource({
      type: 'postgres',
      url,
      entities: [join(__dirname, '..', '..', 'database', 'entities', '*.entity.ts')],
      migrations: [join(__dirname, '..', '..', 'database', 'migrations', '*.ts')],
    }).initialize();
    await dataSource.runMigrations({ transaction: 'all' });
    entries = dataSource.getRepository(Entry);
    revisions = dataSource.getRepository(EntryRevision);
    tasks = new EntryTaskListService(dataSource);
  });
  afterAll(async () => { await dataSource.destroy(); });

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
