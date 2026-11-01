import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { timeCapsuleServiceOn } from '@/modules/time-capsules/time-capsules.test-helpers';
import { StatsMoodService } from './stats-mood.service';

describePostgres('PostgreSQL tags beside the moods', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: StatsMoodService;
  let writerId: number;
  let otherId: number;
  let journal: Diary;
  let work: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new StatsMoodService(dataSource.getRepository(Entry));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  const write = (userId: number, diaryId: number, mood: number | null, tags: string[], extra: Partial<Entry> = {}) =>
    dataSource.getRepository(Entry).save({ userId, diaryId, date: '2026-10-01', content: 'Words', mood, tags, ...extra });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    const diaries = dataSource.getRepository(Diary);
    journal = await diaries.save({ userId: writerId, name: 'Journal', isDefault: true, position: 0 });
    work = await diaries.save({ userId: writerId, name: 'Work', position: 1 });
    const theirs = await diaries.save({ userId: otherId, name: 'Theirs', position: 0 });

    // Good moods (4 and 5) in the journal: family three times, walks and music twice, reading once
    await write(writerId, journal.id, 5, ['family', 'walks']);
    await write(writerId, journal.id, 4, ['family', 'music']);
    await write(writerId, journal.id, 4, ['family', 'walks', 'music', 'reading']);
    // Low moods (1 and 2): family twice, so it is in both lists; work twice, in the other diary
    await write(writerId, journal.id, 2, ['family', 'sleep']);
    await write(writerId, journal.id, 1, ['family']);
    await write(writerId, work.id, 2, ['work']);
    await write(writerId, work.id, 1, ['work', 'sleep']);
    // An okay mood (3) and no mood count in neither list
    await write(writerId, journal.id, 3, ['reading', 'music']);
    await write(writerId, journal.id, null, ['reading', 'walks']);
    // The recycle bin, a sealed time capsule and another writer's entries stay out
    await write(writerId, journal.id, 5, ['reading'], { deletedAt: new Date() });
    await write(writerId, journal.id, 2, ['music'], { deletedAt: new Date() });
    await timeCapsuleServiceOn(dataSource).createSealed(
      writerId,
      { diaryId: journal.id, date: '2026-10-01', content: 'Later', tags: ['reading'], mood: 5 },
      { opensOn: '2036-10-01', timeZone: 'UTC' },
    );
    await write(otherId, theirs.id, 5, ['reading']);
    await write(otherId, theirs.id, 5, ['reading']);
  });

  it('lists the tags on two good entries or more, and on two low ones or more, most first then by name', async () => {
    const moods = await service.analyze(writerId);

    expect(moods.goodMoodTags).toEqual([
      { tag: 'family', entries: 3 },
      { tag: 'music', entries: 2 },
      { tag: 'walks', entries: 2 },
    ]);
    expect(moods.lowMoodTags).toEqual([
      { tag: 'family', entries: 2 },
      { tag: 'sleep', entries: 2 },
      { tag: 'work', entries: 2 },
    ]);
  });

  it('keeps to one diary', async () => {
    const moods = await service.analyze(writerId, work.id);

    expect(moods.goodMoodTags).toEqual([]);
    expect(moods.lowMoodTags).toEqual([{ tag: 'work', entries: 2 }]);
    expect((await service.analyze(writerId, journal.id)).lowMoodTags).toEqual([{ tag: 'family', entries: 2 }]);
  });

  it('shows at most five tags in a list', async () => {
    for (const tag of ['a', 'b', 'c', 'd']) {
      await write(writerId, journal.id, 5, [tag]);
      await write(writerId, journal.id, 5, [tag]);
    }

    expect((await service.analyze(writerId)).goodMoodTags.map((row) => row.tag)).toEqual(['family', 'a', 'b', 'c', 'd']);
  });
});
