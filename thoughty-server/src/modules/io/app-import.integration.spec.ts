import { DataSource, type Repository } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Attachment, Diary, Entry, User } from '@/database/entities';
import { EntryInlineImagesService } from '@/modules/entries/entry-inline-images.service';
import { EntryMentionsService } from '@/modules/entries/entry-mentions.service';
import { AppImportService } from './app-import.service';
import type { AppImportEntryDto } from './dto';

/** What the browser sends for a ZIP of daily notes: each note's path in the archive is its source ID. */
const note = (sourceId: string, date: string, content: string, tags: string[] = []): AppImportEntryDto => ({
  sourceId,
  date,
  content,
  tags,
});

describePostgres('PostgreSQL daily-notes import', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let diaries: Repository<Diary>;
  let service: AppImportService;
  let writerId: number;
  let defaultDiaryId: number;
  let chosenDiaryId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    entries = dataSource.getRepository(Entry);
    diaries = dataSource.getRepository(Diary);
    const attachments = dataSource.getRepository(Attachment);
    // Daily notes go into one chosen diary, so neither diaries nor files are created here
    service = new AppImportService(
      entries,
      diaries,
      attachments,
      {} as never,
      {} as never,
      new EntryMentionsService(entries),
      new EntryInlineImagesService(attachments, entries),
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    writerId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' })).id;
    defaultDiaryId = (await diaries.save({ userId: writerId, name: 'Journal', isDefault: true })).id;
    chosenDiaryId = (await diaries.save({ userId: writerId, name: 'Obsidian', isDefault: false })).id;
  });

  it('puts each note in the chosen diary on its day, after the entries already there, and never twice', async () => {
    await entries.save({ userId: writerId, diaryId: defaultDiaryId, date: '2024-03-14', index: 1, tags: [], content: 'Written here' });
    const vault = [
      note('Daily/2024-03-14.md', '2024-03-14', 'Rain all day. #weather', ['weather']),
      note('journals/2024_03_14.md', '2024-03-14', '- Logseq bullet\n- [[2024-03-13]]'),
      note('2024-02-29.md', '2024-02-29', 'Leap day'),
    ];

    const first = await service.importEntries(writerId, { source: 'daily-notes', diaryId: chosenDiaryId, entries: vault });
    const again = await service.importEntries(writerId, { source: 'daily-notes', diaryId: chosenDiaryId, entries: vault });

    expect(first).toMatchObject({ importedCount: 3, alreadyImportedCount: 0, createdDiaries: [] });
    expect(again).toMatchObject({ importedCount: 0, alreadyImportedCount: 3 });
    expect(again.entries.map((entry) => entry.entryId)).toEqual(first.entries.map((entry) => entry.entryId));
    const saved = await entries.find({ where: { userId: writerId }, order: { date: 'ASC', index: 'ASC' } });
    expect(saved.map((entry) => [entry.date, entry.index, entry.diaryId, entry.importRef, entry.format, entry.visibility])).toEqual([
      ['2024-02-29', 1, chosenDiaryId, 'daily-notes:2024-02-29.md', 'markdown', 'private'],
      ['2024-03-14', 1, defaultDiaryId, null, 'plain', 'private'],
      ['2024-03-14', 2, chosenDiaryId, 'daily-notes:Daily/2024-03-14.md', 'markdown', 'private'],
      ['2024-03-14', 3, chosenDiaryId, 'daily-notes:journals/2024_03_14.md', 'markdown', 'private'],
    ]);
    expect(saved[2]!.tags).toEqual(['weather']);
    expect(saved[3]!.content).toBe('- Logseq bullet\n- [[2024-03-13]]');
  });

  it('keeps a note imported from Day One apart from the same ID in daily notes', async () => {
    await service.importEntries(writerId, { source: 'dayone', entries: [note('2024-01-01.md', '2024-01-01', 'Day One')] });

    const result = await service.importEntries(writerId, {
      source: 'daily-notes',
      entries: [note('2024-01-01.md', '2024-01-01', 'Daily note')],
    });

    expect(result.importedCount).toBe(1);
    const saved = await entries.find({ where: { userId: writerId, date: '2024-01-01' }, order: { index: 'ASC' } });
    expect(saved.map((entry) => [entry.importRef, entry.diaryId])).toEqual([
      ['dayone:2024-01-01.md', defaultDiaryId],
      ['daily-notes:2024-01-01.md', defaultDiaryId],
    ]);
  });

  it('imports a note again once its entry went to the recycle bin', async () => {
    const vault = [note('2024-05-01.md', '2024-05-01', 'May')];
    const [{ entryId }] = (await service.importEntries(writerId, { source: 'daily-notes', entries: vault })).entries;
    await entries.softDelete({ id: entryId });

    const again = await service.importEntries(writerId, { source: 'daily-notes', entries: vault });

    expect(again.importedCount).toBe(1);
    expect(again.entries[0]!.entryId).not.toBe(entryId);
  });
});
