import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Attachment, Diary, Entry, MemoirAnswer, MemoirPhotoAnswer, MemoirProgram, MemoirSnooze, User } from '@/database/entities';
import type { AttachmentsService } from '@/modules/attachments';
import type { ConfigService } from '@/modules/config';
import type { DiariesService } from '@/modules/diaries';
import type { EntriesService } from '@/modules/entries';
import type { LifeErasService } from '@/modules/life-eras';
import { MemoirPhotoAnswersService } from './memoir-photo-answers.service';
import { MemoirService } from './memoir.service';

describePostgres('PostgreSQL memoir photo stories', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let photos: MemoirPhotoAnswersService;
  let memoir: MemoirService;
  let writerId: number;

  const upload = async () =>
    (await dataSource.getRepository(Attachment).save({
      userId: writerId,
      entryId: null,
      originalFilename: 'bakery.jpg',
      storedFilename: `stored-${Date.now()}-${Math.random()}.jpg`,
      mimetype: 'image/jpeg',
      size: 1200,
    })).id;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const entries = dataSource.getRepository(Entry);
    const attachments = dataSource.getRepository(Attachment);
    // The entry is written for real, placing its photo as the entries service does
    const entriesService = {
      create: async (userId: number, dto: { text: string; date: string; diaryId: number }) => {
        const entry = await entries.save({ userId, diaryId: dto.diaryId, date: dto.date, content: dto.text });
        const placed = /attachment:(\d+)/.exec(dto.text);
        if (placed) await attachments.update({ id: Number(placed[1]), userId }, { entryId: entry.id });
        return { entryId: entry.id };
      },
    } as unknown as EntriesService;
    const attachmentsService = {
      getOwnedAttachment: async (userId: number, id: number) => attachments.findOneByOrFail({ id, userId }),
    } as unknown as AttachmentsService;
    photos = new MemoirPhotoAnswersService(
      dataSource.getRepository(MemoirProgram),
      dataSource.getRepository(MemoirPhotoAnswer),
      entriesService,
      attachmentsService,
      { getConfig: async () => ({ language: 'en' }) } as unknown as ConfigService,
      {} as LifeErasService,
    );
    memoir = new MemoirService(
      dataSource.getRepository(MemoirProgram),
      dataSource.getRepository(MemoirAnswer),
      dataSource.getRepository(MemoirSnooze),
      dataSource.getRepository(Diary),
      dataSource.getRepository(User),
      {} as DiariesService,
      { isConfigured: () => false } as never,
      dataSource.getRepository(MemoirPhotoAnswer),
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    writerId = (await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' })).id;
    const diary = await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Memoir', position: 0 });
    await dataSource.getRepository(MemoirProgram).save({ userId: writerId, diaryId: diary.id, deliveryWeekday: 1, nextDeliveryAt: new Date() });
  });

  it('lists each photo story with its words, leaves out one in the recycle bin, and forgets a deleted one', async () => {
    const first = await photos.answer(writerId, { attachmentId: await upload(), caption: 'The bakery', text: 'Grandpa opens his shop.' });
    const second = await photos.answer(writerId, { attachmentId: await upload(), text: 'A wedding in June.' });

    const overview = await memoir.getOverview(writerId);
    expect(overview.photoAnswers.map((answer) => answer.entryId)).toEqual([second.entryId, first.entryId]);
    expect(overview.progress.words).toBe(8);
    const photo = await dataSource.getRepository(Attachment).findOneByOrFail({ userId: writerId, entryId: first.entryId });
    expect(photo.mimetype).toBe('image/jpeg');

    await dataSource.getRepository(Entry).softDelete({ id: second.entryId });
    expect((await memoir.getOverview(writerId)).photoAnswers.map((answer) => answer.entryId)).toEqual([first.entryId]);

    await dataSource.getRepository(Entry).delete({ id: first.entryId });
    // The story in the recycle bin keeps its row until the bin is emptied
    const rows = await dataSource.getRepository(MemoirPhotoAnswer).find({ where: { userId: writerId } });
    expect(rows.map((row) => row.entryId)).toEqual([second.entryId]);
  });
});
