import type { DataSource } from 'typeorm';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, Entry, User } from '@/database/entities';
import { DiariesService, DiaryEntryTransferService } from '@/modules/diaries';
import { StatsGoalService } from './stats-goal.service';

describePostgres('PostgreSQL diary writing goals', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: StatsGoalService;
  let writerId: number;
  let otherId: number;
  let journal: Diary;
  let work: Diary;
  let pages: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new StatsGoalService(dataSource.getRepository(Diary), dataSource.getRepository(Entry));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  const write = (userId: number, diaryId: number, date: string, content: string, deletedAt: Date | null = null) =>
    dataSource.getRepository(Entry).save({ userId, diaryId, date, content, deletedAt });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    const diaries = dataSource.getRepository(Diary);
    journal = await diaries.save({ userId: writerId, name: 'Journal', isDefault: true, position: 0, goalType: 'entries_per_week', goalTarget: 1 });
    work = await diaries.save({ userId: writerId, name: 'Work', position: 1, goalType: 'entries_per_week', goalTarget: 2 });
    pages = await diaries.save({ userId: writerId, name: 'Pages', position: 2, goalType: 'words_per_day', goalTarget: 10 });
    const theirs = await diaries.save({ userId: otherId, name: 'Theirs', position: 0, goalType: 'words_per_day', goalTarget: 10 });

    await write(writerId, work.id, '2026-10-19', 'Planning');
    await write(writerId, work.id, '2026-10-25', 'Review');
    await write(writerId, work.id, '2026-10-27', 'Standup');
    await write(writerId, work.id, '2026-10-28', 'Tomorrow, dated ahead');
    await write(writerId, work.id, '2026-10-27', 'Binned', new Date());
    await write(writerId, pages.id, '2026-10-26', 'one two three four five six seven eight nine ten');
    await write(writerId, pages.id, '2026-10-27', '  six words   across\ntwo short lines ');
    await write(writerId, pages.id, '2026-10-27', 'and four more words');
    await write(otherId, theirs.id, '2026-10-27', 'one two three four five six seven eight nine ten eleven');
  });

  it('measures each diary’s goal from its own entries, leaving out binned and later ones', async () => {
    const goals = await service.analyze(writerId, undefined, '2026-10-27');

    expect(goals.map((goal) => goal.diaryName)).toEqual(['Journal', 'Work', 'Pages']);
    expect(goals[0]).toEqual(expect.objectContaining({ progress: 0, met: false, currentStreak: 0, metPeriods: [] }));
    expect(goals[1]).toEqual(expect.objectContaining({
      period: 'week', periodStart: '2026-10-26', progress: 1, met: false, currentStreak: 1, metPeriods: ['2026-10-19'],
    }));
    expect(goals[2]).toEqual(expect.objectContaining({
      period: 'day', periodStart: '2026-10-27', progress: 10, met: true, currentStreak: 2, longestStreak: 2,
      metPeriods: ['2026-10-26', '2026-10-27'],
    }));
  });

  it('scopes the goals to the writer’s own diary', async () => {
    await expect(service.analyze(writerId, pages.id, '2026-10-27')).resolves.toEqual([expect.objectContaining({ diaryId: pages.id })]);
    await expect(service.analyze(otherId, pages.id, '2026-10-27')).resolves.toEqual([]);
  });

  it('keeps the type and target together and within their bounds', async () => {
    const setGoal = (type: string | null, target: number | null) =>
      dataSource.query('UPDATE diaries SET goal_type = $1, goal_target = $2 WHERE id = $3', [type, target, work.id]);

    await expect(setGoal('words_per_day', 9)).rejects.toThrow(/chk_diaries_goal/);
    await expect(setGoal('entries_per_week', 51)).rejects.toThrow(/chk_diaries_goal/);
    await expect(setGoal('entries_per_week', null)).rejects.toThrow(/chk_diaries_goal/);
    await expect(setGoal(null, 3)).rejects.toThrow(/chk_diaries_goal/);
    await expect(setGoal('pages_per_month', 3)).rejects.toThrow(/chk_diaries_goal/);
    await expect(setGoal('words_per_day', 10000)).resolves.toBeDefined();
    await expect(setGoal(null, null)).resolves.toBeDefined();
  });

  it('removes a deleted diary’s goal; its entries count towards the default diary’s goal', async () => {
    const diaries = new DiariesService(
      dataSource.getRepository(Diary),
      new DiaryEntryTransferService(dataSource.getRepository(Entry)),
    );

    await diaries.delete(writerId, work.id);

    const goals = await service.analyze(writerId, undefined, '2026-10-27');
    expect(goals.map((goal) => goal.diaryId)).toEqual([journal.id, pages.id]);
    expect(goals[0]).toEqual(expect.objectContaining({ progress: 1, met: true, metPeriods: ['2026-10-19', '2026-10-26'] }));
  });
});
