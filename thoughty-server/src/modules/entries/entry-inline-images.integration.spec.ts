import { DataSource, type Repository } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Attachment, Diary, Entry, EntryRevision, User } from '@/database/entities';
import { timeCapsuleServiceOn } from '@/modules/time-capsules/time-capsules.test-helpers';
import { EntriesCommandService } from './entries-command.service';
import { EntryInlineImagesService } from './entry-inline-images.service';
import { EntryMentionsService } from './entry-mentions.service';

describePostgres('PostgreSQL inline images', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let attachments: Repository<Attachment>;
  let inlineImages: EntryInlineImagesService;
  let commands: EntriesCommandService;
  let writerId: number;
  let otherId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    attachments = dataSource.getRepository(Attachment);
    inlineImages = new EntryInlineImagesService(attachments, entries);
    commands = new EntriesCommandService(
      entries,
      dataSource.getRepository(EntryRevision),
      dataSource.getRepository(Diary),
      { resolveSavedTags: async (_user: number, _text: string, tags: string[]) => tags } as never,
      { getConfig: jest.fn().mockResolvedValue({ maxPinnedEntries: '3' }) } as never,
      new EntryMentionsService(entries),
      timeCapsuleServiceOn(dataSource),
      inlineImages,
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
  });

  const upload = (userId: number, entryId: number | null, name = 'pier.png') =>
    attachments.save({ userId, entryId, originalFilename: name, storedFilename: `${name}-${Math.random()}`, mimetype: 'image/png', size: 10 });

  it('places the writer’s composer uploads in a new entry and keeps nobody else’s pictures', async () => {
    const unplaced = await upload(writerId, null);
    const strangers = await upload(otherId, null);
    const elsewhere = await entries.save({ userId: writerId, date: '2024-01-01', index: 1, tags: [], content: 'Old', format: 'markdown' as const });
    const onOtherEntry = await upload(writerId, elsewhere.id);

    const { entryId } = await commands.create(writerId, {
      text: `Pier ![The pier](attachment:${unplaced.id}) ![Theirs](attachment:${strangers.id}) ![Old](attachment:${onOtherEntry.id})`,
      tags: [],
      format: 'markdown',
      date: '2024-02-01',
    });

    const saved = await entries.findOneByOrFail({ id: entryId });
    expect(saved.content).toBe(`Pier ![The pier](attachment:${unplaced.id}) Theirs Old`);
    expect((await attachments.findOneByOrFail({ id: unplaced.id })).entryId).toBe(entryId);
    expect((await attachments.findOneByOrFail({ id: strangers.id })).entryId).toBeNull();
    expect((await attachments.findOneByOrFail({ id: onOtherEntry.id })).entryId).toBe(elsewhere.id);
  });

  it('keeps a picture whose attachment was deleted through later edits, but not a new one pasted from elsewhere', async () => {
    const entry = await entries.save({ userId: writerId, date: '2024-01-01', index: 1, tags: [], content: 'Draft', format: 'markdown' as const });
    const photo = await upload(writerId, entry.id);
    await commands.update(writerId, entry.id, { text: `Draft ![Sea](attachment:${photo.id})`, tags: [], date: '2024-01-01' });

    await attachments.delete({ id: photo.id });
    const other = await entries.save({ userId: writerId, date: '2024-01-02', index: 1, tags: [], content: 'x', format: 'markdown' as const });
    const pasted = await upload(writerId, other.id);
    await commands.update(writerId, entry.id, {
      text: `Edited ![Sea at dusk](attachment:${photo.id}) ![Pasted](attachment:${pasted.id})`,
      tags: [],
      date: '2024-01-01',
    });

    expect((await entries.findOneByOrFail({ id: entry.id })).content).toBe(`Edited ![Sea at dusk](attachment:${photo.id}) Pasted`);
  });

  it('turns the photos an app import named into references once their files are stored', async () => {
    const entry = await entries.save({
      userId: writerId, date: '2024-01-01', index: 1, tags: [], format: 'markdown' as const,
      content: 'Walk ![](attachment:abc.jpeg) and ![Later](attachment:def.jpeg)',
    });
    const stored = await upload(writerId, entry.id, 'abc.jpeg');

    await inlineImages.resolveImportedFiles(writerId, [{ id: stored.id, entryId: entry.id, originalFilename: 'abc.jpeg' }]);
    await inlineImages.resolveImportedFiles(otherId, [{ id: stored.id, entryId: entry.id, originalFilename: 'def.jpeg' }]);

    expect((await entries.findOneByOrFail({ id: entry.id })).content).toBe(`Walk ![](attachment:${stored.id}) and ![Later](attachment:def.jpeg)`);
  });
});
