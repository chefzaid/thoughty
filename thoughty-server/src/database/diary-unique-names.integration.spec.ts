import { ConflictException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { DiariesService } from '@/modules/diaries/diaries.service';
import type { DiaryEntryTransferService } from '@/modules/diaries/diary-entry-transfer.service';
import { Diary } from './entities';
import { DiaryUniqueNames1787011200000 } from './migrations/1787011200000-diary-unique-names';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from './postgres-test-database.test-helpers';

describePostgres('DiaryUniqueNames1787011200000 on PostgreSQL', () => {
  let database: PostgresTestDatabase;
  let service: DiariesService;

  const addUser = async (username: string): Promise<number> => {
    const [{ id }] = await database.dataSource.query(
      `INSERT INTO users (username, email, auth_provider) VALUES ($1, $2, 'local') RETURNING id`,
      [username, `${username}@example.com`],
    );
    return id;
  };

  const addDiary = async (userId: number, name: string, createdAt: string): Promise<number> => {
    const [{ id }] = await database.dataSource.query(
      `INSERT INTO diaries (user_id, name, created_at) VALUES ($1, $2, $3) RETURNING id`,
      [userId, name, createdAt],
    );
    return id;
  };

  const namesOf = async (userId: number): Promise<string[]> =>
    (await database.dataSource.query('SELECT name FROM diaries WHERE user_id = $1 ORDER BY id', [userId])).map(
      ({ name }: { name: string }) => name,
    );

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    service = new DiariesService(database.dataSource.getRepository(Diary), {} as DiaryEntryTransferService);
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await database?.drop();
  });

  it('keeps the oldest name, numbers the later duplicates past the names already used, and keeps their entries', async () => {
    const { dataSource } = database;
    const migration = new DiaryUniqueNames1787011200000();
    const queryRunner = dataSource.createQueryRunner();
    await migration.down(queryRunner);
    const writer = await addUser('duplicates');
    const other = await addUser('other');
    const later = await addDiary(writer, 'travel', '2024-03-01');
    const oldest = await addDiary(writer, 'Travel', '2024-01-01');
    await addDiary(writer, 'Travel (2)', '2024-02-01');
    const spaced = await addDiary(writer, ' TRAVEL ', '2024-04-01');
    await addDiary(writer, `${'L'.repeat(98)}ab`, '2024-01-01');
    await addDiary(writer, `${'l'.repeat(98)}AB`, '2024-01-02');
    await addDiary(other, 'Travel', '2024-05-01');
    await dataSource.query(`INSERT INTO entries (user_id, diary_id, date, content) VALUES ($1, $2, '2024-03-02', 'Kept')`, [
      writer,
      later,
    ]);

    // Migrations run in a transaction (`transaction: 'all'`), which the table lock needs.
    await queryRunner.startTransaction();
    // As `runPendingMigrations` does: the journal list triggers of later migrations fire per statement
    await queryRunner.query('SET CONSTRAINTS ALL IMMEDIATE');
    await migration.up(queryRunner);
    await queryRunner.commitTransaction();
    await queryRunner.release();

    expect(await namesOf(writer)).toEqual([
      'travel (3)',
      'Travel',
      'Travel (2)',
      'TRAVEL (4)',
      `${'L'.repeat(98)}ab`,
      `${'l'.repeat(96)} (2)`,
    ]);
    expect(await namesOf(other)).toEqual(['Travel']);
    expect(await dataSource.query('SELECT diary_id FROM entries WHERE user_id = $1', [writer])).toEqual([{ diary_id: later }]);
    expect(oldest).toBeLessThan(spaced);
    await expect(addDiary(writer, ' travel (2)', '2024-06-01')).rejects.toMatchObject({
      code: '23505',
      constraint: 'uq_diaries_user_name',
    });
  });

  it('answers DIARY_NAME_TAKEN for another diary of that name in any case, and lets a diary change its own case', async () => {
    const writer = await addUser('writer');
    const work = await service.create(writer, { name: 'Work' });
    const garden = await service.create(writer, { name: 'Garden' });

    await expectApiError(service.create(writer, { name: '  WORK ' }), ConflictException, 'DIARY_NAME_TAKEN');
    await expectApiError(service.update(writer, garden.id, { name: 'work' }), ConflictException, 'DIARY_NAME_TAKEN');
    await expect(service.update(writer, work.id, { name: 'WORK' })).resolves.toMatchObject({ name: 'WORK' });
    await expect(service.create(await addUser('neighbour'), { name: 'Work' })).resolves.toMatchObject({ name: 'Work' });
    await expect(service.findByName(writer, ' work ')).resolves.toMatchObject({ id: work.id });
  });

  it('lets only one of several parallel requests take a name', async () => {
    const writer = await addUser('racer');

    const results = await Promise.allSettled(
      ['Dreams', 'dreams', 'DREAMS', ' Dreams', 'Dreams '].map((name) => service.create(writer, { name })),
    );

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const refused = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    expect(refused.map(({ reason }) => reason)).toEqual(Array(4).fill(expect.any(ConflictException)));
    expect(await namesOf(writer)).toHaveLength(1);
  });
});
