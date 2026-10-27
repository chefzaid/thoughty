import type { QueryRunner } from 'typeorm';
import { DiaryGoals1786406400000 } from './migrations/1786406400000-diary-goals';

describe('DiaryGoals1786406400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('adds an optional goal whose type and target are set together, within each type’s bounds', async () => {
    await new DiaryGoals1786406400000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ALTER TABLE diaries');
    expect(sql).toContain('ADD COLUMN goal_type VARCHAR(20)');
    expect(sql).toContain('ADD COLUMN goal_target INTEGER');
    expect(sql).toContain('CHECK (COALESCE(');
    expect(sql).toContain('(goal_type IS NULL AND goal_target IS NULL)');
    expect(sql).toContain("(goal_type = 'entries_per_week' AND goal_target BETWEEN 1 AND 50)");
    expect(sql).toContain("(goal_type = 'words_per_day' AND goal_target BETWEEN 10 AND 10000)");
  });

  it('drops the constraint and the columns', async () => {
    await new DiaryGoals1786406400000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS chk_diaries_goal');
    expect(sql).toContain('DROP COLUMN IF EXISTS goal_target');
    expect(sql).toContain('DROP COLUMN IF EXISTS goal_type');
  });
});
