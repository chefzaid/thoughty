import type { QueryRunner } from 'typeorm';
import { WeeklyReflections1788825600000 } from './migrations/1788825600000-weekly-reflections';

describe('WeeklyReflections1788825600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one seven-day reflection per writer and diary scope, gone with the account or the diary', async () => {
    await new WeeklyReflections1788825600000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE weekly_reflections');
    expect(sql).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('diary_id INTEGER REFERENCES diaries(id) ON DELETE CASCADE');
    expect(sql).toContain('themes JSONB NOT NULL');
    expect(sql).toContain('question TEXT NOT NULL');
    expect(sql).toContain('CHECK (week_end = week_start + 6)');
    expect(sql).toMatch(/CREATE UNIQUE INDEX uq_weekly_reflections_scope\s+ON weekly_reflections\(user_id, COALESCE\(diary_id, 0\)\)/);
  });

  it('drops the table', async () => {
    await new WeeklyReflections1788825600000().down(queryRunner);

    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('DROP TABLE IF EXISTS weekly_reflections');
  });
});
