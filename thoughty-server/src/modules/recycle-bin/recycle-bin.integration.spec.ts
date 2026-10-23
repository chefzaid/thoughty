import { join } from 'node:path';
import { DataSource, type Repository } from 'typeorm';
import { Attachment, Diary, Entry, EntryRevision, MemoirAnswer, User } from '@/database/entities';
import { DiariesService } from '@/modules/diaries/diaries.service';
import { DiaryEntryTransferService } from '@/modules/diaries/diary-entry-transfer.service';
import { EntriesCommandService } from '@/modules/entries/entries-command.service';
import { EntriesQueryService } from '@/modules/entries/entries-query.service';
import { EntrySearchService } from '@/modules/entries/entry-search.service';
import { RecycleBinService } from './recycle-bin.service';

const url = process.env.THOUGHTY_PG_TEST_URL;
if (url && (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || new URL(url).pathname !== '/thoughty_ha_test')) {
  throw new Error('Use the isolated thoughty_ha_test localhost fixture');
}
const integration = url ? describe : describe.skip;
const DAY_MS = 24 * 60 * 60 * 1000;

integration('PostgreSQL recycle bin', () => {
  let dataSource: DataSource;
  let entries: Repository<Entry>;
  let diaries: Repository<Diary>;
  let attachments: Repository<Attachment>;
  let revisions: Repository<EntryRevision>;
  let commands: EntriesCommandService;
  let queries: EntriesQueryService;
  let bin: RecycleBinService;
  let diariesService: DiariesService;
  let removeStoredFiles: jest.Mock;
  let userId: number;
  let defaultDiary: Diary;
  let travelDiary: Diary;

  beforeAll(async () => {
    dataSource = await new DataSource({
      type: 'postgres',
      url,
      entities: [join(__dirname, '..', '..', 'database', 'entities', '*.entity.ts')],
      migrations: [join(__dirname, '..', '..', 'database', 'migrations', '*.ts')],
    }).initialize();
    await dataSource.runMigrations({ transaction: 'all' });
    entries = dataSource.getRepository(Entry);
    diaries = dataSource.getRepository(Diary);
    attachments = dataSource.getRepository(Attachment);
    revisions = dataSource.getRepository(EntryRevision);
  });
  afterAll(async () => { await dataSource.destroy(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const user = await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' });
    userId = user.id;
    defaultDiary = await diaries.save({ userId, name: 'Journal', isDefault: true, position: 0 });
    travelDiary = await diaries.save({ userId, name: 'Travel', position: 1 });

    const configService = { getConfig: jest.fn().mockResolvedValue({ maxPinnedEntries: '3' }) };
    commands = new EntriesCommandService(
      entries,
      revisions,
      diaries,
      { resolveSavedTags: async (_user: number, _text: string, tags: string[]) => tags } as never,
      configService as never,
    );
    queries = new EntriesQueryService(entries, revisions, new EntrySearchService(entries));
    removeStoredFiles = jest.fn().mockResolvedValue(undefined);
    bin = new RecycleBinService(
      dataSource,
      entries,
      attachments,
      { removeStoredFiles } as never,
      configService as never,
      { invalidateUser: jest.fn() } as never,
    );
    diariesService = new DiariesService(diaries, new DiaryEntryTransferService(entries));
  });

  const write = (content: string, overrides: Partial<Entry> = {}) => entries.save({
    userId,
    diaryId: travelDiary.id,
    date: '2026-10-20',
    index: 1,
    tags: ['walks'],
    content,
    ...overrides,
  });
  const journal = async () => (await queries.getEntries(userId, { page: 1, limit: 20 })).entries
    .map((entry) => `${entry.content}#${entry.index}`);

  it('takes a deleted entry out of the journal with its history kept, then restores it at the end of its day', async () => {
    const first = await write('First', { index: 1 });
    const second = await write('Second', { index: 2, tags: ['harbor'] });
    await write('Third', { index: 3 });
    await revisions.save({ entryId: second.id, userId, content: 'Older second', tags: [], date: '2026-10-20' });
    await attachments.save({ userId, entryId: second.id, originalFilename: 'boat.jpg', storedFilename: 'boat-key.jpg', mimetype: 'image/jpeg', size: 10 });

    await commands.delete(userId, second.id);

    expect(await journal()).toEqual(['First#1', 'Third#2']);
    expect((await queries.getTagUsage(userId)).tags.map((usage) => usage.tag)).toEqual(['walks']);
    expect((await queries.getDates(userId)).dates).toEqual(['2026-10-20']);
    await expect(queries.getRevisions(userId, second.id)).rejects.toThrow('Entry not found');
    expect(await revisions.count({ where: { entryId: second.id } })).toBe(1);

    const listed = await bin.list(userId);
    expect(listed.total).toBe(1);
    expect(listed.entries[0]).toEqual(expect.objectContaining({
      id: second.id,
      content: 'Second',
      diaryId: travelDiary.id,
      diaryName: 'Travel',
      attachmentCount: 1,
    }));
    expect(new Date(listed.entries[0].purgeAt).getTime() - new Date(listed.entries[0].deletedAt).getTime()).toBe(30 * DAY_MS);

    await commands.create(userId, { text: 'Fourth', tags: [], date: '2026-10-20' });
    await expect(bin.restore(userId, [second.id])).resolves.toEqual({ success: true, restoredCount: 1, movedToDefaultCount: 0 });

    expect(await journal()).toEqual(['First#1', 'Third#2', 'Fourth#3', 'Second#4']);
    expect(await attachments.count({ where: { entryId: second.id } })).toBe(1);
    expect((await bin.list(userId)).total).toBe(0);
    expect(first.id).toBeLessThan(second.id);
  });

  it('restores into the default diary when the original diary is gone, and drops an import reference that is taken again', async () => {
    const imported = await write('Imported', { importRef: 'dayone:abc' });
    const orphan = await write('Orphan', { diaryId: 999, date: '2026-10-21' });
    await commands.bulkOperation(userId, { ids: [imported.id, orphan.id], action: 'delete' });

    // Importing the same export again is allowed while the first copy is in the bin
    await write('Imported again', { importRef: 'dayone:abc', diaryId: defaultDiary.id, date: '2026-10-22' });
    await diariesService.delete(userId, travelDiary.id);

    await expect(bin.restore(userId)).resolves.toEqual({ success: true, restoredCount: 2, movedToDefaultCount: 1 });

    const restored = await entries.find({ where: { userId }, order: { id: 'ASC' } });
    expect(restored.map((entry) => [entry.content, entry.diaryId, entry.importRef])).toEqual([
      ['Imported', defaultDiary.id, null],
      ['Orphan', defaultDiary.id, null],
      ['Imported again', defaultDiary.id, 'dayone:abc'],
    ]);
  });

  it('loads memoir answers without an entry that is in the bin, so the question counts as open', async () => {
    const answer = await write('### Home\n\nA narrow house');
    await dataSource.getRepository(MemoirAnswer).insert({ userId, questionId: 'childhood-home', entryId: answer.id });
    await commands.delete(userId, answer.id);

    const answers = await dataSource.getRepository(MemoirAnswer).find({
      where: { userId },
      relations: { entry: true },
      select: { questionId: true, entryId: true, entry: { id: true } },
    });

    expect(answers).toEqual([expect.objectContaining({ questionId: 'childhood-home', entryId: answer.id, entry: null })]);
  });

  it('moves only live entries on delete all, keeping the deletion time of entries already in the bin', async () => {
    const early = await write('Early');
    await write('Later', { index: 2 });
    await write('Elsewhere', { diaryId: defaultDiary.id, date: '2026-10-21' });
    await commands.delete(userId, early.id);
    const earlyDeletedAt = (await entries.findOneOrFail({ where: { id: early.id }, withDeleted: true })).deletedAt;

    await expect(commands.deleteAll(userId, travelDiary.id)).resolves.toEqual({ success: true, deletedCount: 1 });

    expect(await journal()).toEqual(['Elsewhere#1']);
    expect((await entries.findOneOrFail({ where: { id: early.id }, withDeleted: true })).deletedAt).toEqual(earlyDeletedAt);
    expect((await bin.list(userId)).total).toBe(2);
  });

  it('purges entries older than 30 days with their history, memoir link, and files, and leaves newer ones', async () => {
    const old = await write('Old');
    const recent = await write('Recent', { index: 2 });
    await revisions.save({ entryId: old.id, userId, content: 'Older', tags: [], date: '2026-10-20' });
    await attachments.save({ userId, entryId: old.id, originalFilename: 'old.m4a', storedFilename: 'old-key.m4a', mimetype: 'audio/mp4', size: 10 });
    await dataSource.getRepository(MemoirAnswer).insert({ userId, questionId: 'childhood-home', entryId: old.id });
    const now = new Date();
    await entries.update({ id: old.id }, { deletedAt: new Date(now.getTime() - 31 * DAY_MS) });
    await entries.update({ id: recent.id }, { deletedAt: new Date(now.getTime() - 2 * DAY_MS) });

    await expect(bin.purgeExpired(now)).resolves.toBe(1);

    expect(await entries.findOne({ where: { id: old.id }, withDeleted: true })).toBeNull();
    expect(await revisions.count({ where: { entryId: old.id } })).toBe(0);
    expect(await attachments.count({ where: { entryId: old.id } })).toBe(0);
    expect(await dataSource.getRepository(MemoirAnswer).count({ where: { userId } })).toBe(0);
    expect(removeStoredFiles).toHaveBeenCalledWith(['old-key.m4a']);
    expect((await bin.list(userId)).entries.map((entry) => entry.id)).toEqual([recent.id]);
  });

  it('empties only the writer’s own bin and refuses entries that are not in it', async () => {
    const mine = await write('Mine');
    const other = await dataSource.getRepository(User).save({ username: 'other', email: 'other@example.com' });
    const theirs = await entries.save({ userId: other.id, date: '2026-10-20', index: 1, tags: [], content: 'Theirs' });
    await entries.softDelete({ id: theirs.id });
    const live = await write('Live', { index: 2 });
    await commands.delete(userId, mine.id);

    await expect(bin.deletePermanently(userId, [live.id, theirs.id])).rejects.toThrow('No matching entries');
    await expect(bin.restore(userId, [theirs.id])).rejects.toThrow('No matching entries');
    await expect(bin.deletePermanently(userId)).resolves.toBe(1);

    expect(await entries.findOne({ where: { id: theirs.id }, withDeleted: true })).not.toBeNull();
    expect(await journal()).toEqual(['Live#1']);
  });
});
