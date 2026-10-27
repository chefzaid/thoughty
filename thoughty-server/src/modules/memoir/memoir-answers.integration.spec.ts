import { ConflictException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, MemoirAnswer, MemoirProgram, User } from '@/database/entities';
import type { AttachmentsService } from '@/modules/attachments';
import type { ConfigService } from '@/modules/config';
import type { EntriesService } from '@/modules/entries';
import type { LifeErasService } from '@/modules/life-eras';
import { MemoirAnswersService } from './memoir-answers.service';
import { MEMOIR_QUESTIONS } from './memoir-questions';

describePostgres('PostgreSQL memoir answers', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: MemoirAnswersService;
  let writerId: number;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    const entries = dataSource.getRepository(Entry);
    // The answer's entry is written for real, so the answer row can reference it
    const entriesService = {
      create: async (userId: number, dto: { text: string; date: string; diaryId: number }) => ({
        entryId: (
          await entries.save({ userId, diaryId: dto.diaryId, date: dto.date, content: dto.text })
        ).id,
      }),
      delete: async (userId: number, id: number) => entries.softDelete({ id, userId }),
    } as unknown as EntriesService;
    service = new MemoirAnswersService(
      dataSource.getRepository(MemoirProgram),
      dataSource.getRepository(MemoirAnswer),
      entriesService,
      {} as AttachmentsService,
      { getConfig: async () => ({ language: 'en' }) } as unknown as ConfigService,
      {} as LifeErasService,
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => {
    await database?.drop();
  });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    writerId = (
      await dataSource.getRepository(User).save({ username: 'writer', email: 'writer@example.com' })
    ).id;
    const diary = await dataSource
      .getRepository(Diary)
      .save({ userId: writerId, name: 'Memoir', position: 0 });
    await dataSource.getRepository(MemoirProgram).save({
      userId: writerId,
      diaryId: diary.id,
      deliveryWeekday: 1,
      nextDeliveryAt: new Date(),
    });
  });

  it('answers a question once, and again once its entry is in the recycle bin', async () => {
    const questionId = MEMOIR_QUESTIONS[0]!.id;

    const first = await service.answer(writerId, { questionId, text: 'By the sea.' });
    expect(first.questionId).toBe(questionId);
    await expectApiError(
      service.answer(writerId, { questionId, text: 'Twice' }),
      ConflictException,
      'MEMOIR_ALREADY_ANSWERED',
    );

    await dataSource.getRepository(Entry).softDelete({ id: first.entryId });
    const again = await service.answer(writerId, { questionId, text: 'In the mountains.' });
    expect(again.entryId).not.toBe(first.entryId);
    const stored = await dataSource
      .getRepository(MemoirAnswer)
      .findOneByOrFail({ userId: writerId, questionId });
    expect(stored.entryId).toBe(again.entryId);
  });
});
