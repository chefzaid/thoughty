import type { QueryRunner } from 'typeorm';
import { MemoirProgram1785628800000 } from './migrations/1785628800000-memoir-program';

describe('MemoirProgram1785628800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates one program per user with a due-delivery index and one answer per question', async () => {
    await new MemoirProgram1785628800000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE memoir_programs');
    expect(sql).toContain('user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('diary_id INTEGER REFERENCES diaries(id) ON DELETE SET NULL');
    expect(sql).toContain("CHECK (status IN ('active', 'paused'))");
    expect(sql).toContain('CHECK (delivery_weekday BETWEEN 0 AND 6)');
    expect(sql).toMatch(/CREATE INDEX idx_memoir_programs_due\s+ON memoir_programs\(next_delivery_at\)\s+WHERE status = 'active'/);
    expect(sql).toContain('CREATE TABLE memoir_answers');
    expect(sql).toContain('entry_id INTEGER NOT NULL UNIQUE REFERENCES entries(id) ON DELETE CASCADE');
    expect(sql).toContain('PRIMARY KEY (user_id, question_id)');
  });

  it('drops the answers before the programs', async () => {
    await new MemoirProgram1785628800000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql.indexOf('DROP TABLE IF EXISTS memoir_answers')).toBeLessThan(
      sql.indexOf('DROP TABLE IF EXISTS memoir_programs'),
    );
  });
});
