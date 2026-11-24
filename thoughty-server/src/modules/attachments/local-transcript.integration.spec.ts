import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Attachment, Entry } from '@/database/entities';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { AttachmentsService } from './attachments.service';
import { LocalTranscriptService } from './local-transcript.service';

describePostgres('PostgreSQL transcripts made by the writer’s own model', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: LocalTranscriptService;
  let writer = 0;
  let stranger = 0;
  let localDiary = 0;

  const insert = async (sql: string, parameters: unknown[]): Promise<number> =>
    (await dataSource.query(`${sql} RETURNING id`, parameters))[0].id;

  const diary = (name: string, aiMode: string) =>
    insert('INSERT INTO diaries (user_id, name, ai_mode) VALUES ($1, $2, $3)', [writer, name, aiMode]);

  const recordingIn = async (diaryId: number | null, mimetype = 'audio/webm'): Promise<number> => {
    const entryId = diaryId === null ? null : await insert(
      `INSERT INTO entries (user_id, diary_id, date, content) VALUES ($1, $2, '2026-11-24', 'Voice note')`,
      [writer, diaryId],
    );
    return (await dataSource.getRepository(Attachment).save({
      userId: writer,
      entryId,
      originalFilename: 'note.webm',
      storedFilename: `stored-${Date.now()}-${Math.random()}.webm`,
      mimetype,
      size: 2048,
    })).id;
  };

  const stored = async (id: number) =>
    (await dataSource.query('SELECT transcript, transcribed_at FROM attachments WHERE id = $1', [id]))[0];

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    writer = await insert(`INSERT INTO users (username, email, auth_provider) VALUES ('writer', 'writer@example.com', 'local')`, []);
    stranger = await insert(`INSERT INTO users (username, email, auth_provider) VALUES ('other', 'other@example.com', 'local')`, []);
    localDiary = await diary('Letters', 'local');
    service = new LocalTranscriptService(
      new AttachmentsService(dataSource.getRepository(Attachment), dataSource.getRepository(Entry)),
    );
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps the text in the attachment’s transcript columns, as a transcript Thoughty made', async () => {
    const id = await recordingIn(localDiary);

    const answer = await service.store(writer, id, 'Written down on my own machine');

    const row = await stored(id);
    expect(row.transcript).toBe('Written down on my own machine');
    expect(row.transcribed_at).toBeInstanceOf(Date);
    expect(answer).toMatchObject({ transcript: 'Written down on my own machine', cached: false });
  });

  it('refuses the recording to anyone but its owner, and keeps nothing', async () => {
    const id = await recordingIn(localDiary);

    await expectApiError(service.store(stranger, id, 'Not mine'), NotFoundException, 'ATTACHMENT_NOT_FOUND');
    expect((await stored(id)).transcript).toBeNull();
  });

  it('refuses a recording in a diary on any other mode, or on no entry yet', async () => {
    for (const mode of ['on', 'off', 'ask']) {
      const id = await recordingIn(await diary(`Diary ${mode}`, mode));
      await expectApiError(service.store(writer, id, 'Text'), ForbiddenException, 'TRANSCRIPT_LOCAL_DIARY_ONLY');
      expect((await stored(id)).transcript).toBeNull();
    }
    await expectApiError(service.store(writer, await recordingIn(null), 'Text'), ForbiddenException, 'TRANSCRIPT_LOCAL_DIARY_ONLY');
  });

  it('follows the diary’s mode as it changes', async () => {
    const moving = await diary('Dreams', 'local');
    const id = await recordingIn(moving);
    await dataSource.query(`UPDATE diaries SET ai_mode = 'on' WHERE id = $1`, [moving]);

    await expectApiError(service.store(writer, id, 'Text'), ForbiddenException, 'TRANSCRIPT_LOCAL_DIARY_ONLY');
  });

  it('refuses a file that is not a recording', async () => {
    await expectApiError(service.store(writer, await recordingIn(localDiary, 'image/png'), 'Text'), BadRequestException, 'ATTACHMENT_NOT_AUDIO');
  });
});
