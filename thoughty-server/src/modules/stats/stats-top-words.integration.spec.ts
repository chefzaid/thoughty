import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { timeCapsuleServiceOn } from '@/modules/time-capsules/time-capsules.test-helpers';
import { StatsTopWordsService } from './stats-top-words.service';

describePostgres('PostgreSQL words you use most', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: StatsTopWordsService;
  let writerId: number;
  let journal: Diary;
  let work: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new StatsTopWordsService(dataSource.getRepository(Entry));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  const write = (userId: number, diaryId: number, date: string, content: string, extra: Partial<Entry> = {}) =>
    dataSource.getRepository(Entry).save({ userId, diaryId, date, content, ...extra });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    const otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    const diaries = dataSource.getRepository(Diary);
    journal = await diaries.save({ userId: writerId, name: 'Journal', isDefault: true, position: 0 });
    work = await diaries.save({ userId: writerId, name: 'Work', position: 1 });
    const theirs = await diaries.save({ userId: otherId, name: 'Theirs', position: 0 });

    // November, up to the writer's day (the 10th), in both diaries and both languages
    await write(writerId, journal.id, '2026-11-01', 'The **garden** after the rain, with @Marie. https://garden.example');
    await write(writerId, journal.id, '2026-11-10', 'Le jardin sous la pluie ; l’odeur du jardin. Garden again.');
    await write(writerId, work.id, '2026-11-05', 'Meeting, then another meeting about the garden.');
    // October, a day dated after the writer's day, the recycle bin, a sealed capsule and another writer stay out
    await write(writerId, journal.id, '2026-10-31', 'Pumpkin pumpkin pumpkin');
    await write(writerId, journal.id, '2026-11-11', 'Tomorrow tomorrow tomorrow');
    await write(writerId, journal.id, '2026-11-02', 'Binned binned binned', { deletedAt: new Date() });
    await timeCapsuleServiceOn(dataSource).createSealed(
      writerId,
      { diaryId: journal.id, date: '2026-11-03', content: 'Secret secret secret' },
      { opensOn: '2036-11-03', timeZone: 'UTC' },
    );
    await write(otherId, theirs.id, '2026-11-04', 'Theirs theirs garden garden');
  });

  it('ranks the words of the writer’s month up to their day, without the bin, sealed capsules or other writers', async () => {
    await expect(service.analyze(writerId, undefined, '2026-11-10')).resolves.toEqual({
      month: '2026-11',
      words: [
        { word: 'garden', count: 3 },
        { word: 'jardin', count: 2 },
        { word: 'meeting', count: 2 },
      ],
    });
  });

  it('keeps to one diary', async () => {
    await expect(service.analyze(writerId, work.id, '2026-11-10')).resolves.toEqual({
      month: '2026-11',
      words: [{ word: 'meeting', count: 2 }],
    });
    expect((await service.analyze(writerId, journal.id, '2026-11-10')).words).toEqual([
      { word: 'garden', count: 2 },
      { word: 'jardin', count: 2 },
    ]);
  });

  it('reads the month of the writer’s day, which can be the last one', async () => {
    await expect(service.analyze(writerId, undefined, '2026-10-31')).resolves.toEqual({
      month: '2026-10',
      words: [{ word: 'pumpkin', count: 3 }],
    });
  });
});
