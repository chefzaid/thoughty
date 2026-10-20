import type { QueryRunner } from 'typeorm';
import { YearReviewMoods1785801600000 } from './migrations/1785801600000-year-review-moods';

describe('YearReviewMoods1785801600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('keeps one mood reading per writer, year, and diary scope', async () => {
    await new YearReviewMoods1785801600000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE year_review_moods');
    expect(sql).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('diary_id INTEGER REFERENCES diaries(id) ON DELETE CASCADE');
    expect(sql).toContain('months JSONB NOT NULL');
    expect(sql).toMatch(/CREATE UNIQUE INDEX uq_year_review_moods_scope\s+ON year_review_moods\(user_id, year, COALESCE\(diary_id, 0\)\)/);
  });

  it('drops the table', async () => {
    await new YearReviewMoods1785801600000().down(queryRunner);

    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('DROP TABLE IF EXISTS year_review_moods');
  });
});
