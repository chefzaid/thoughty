import type { QueryRunner } from 'typeorm';
import { PersonDates1787702400000 } from './migrations/1787702400000-person-dates';

describe('PersonDates1787702400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('adds an optional kind, month, day and year that are set together and always name a real day', async () => {
    await new PersonDates1787702400000().up(queryRunner);

    expect(sql()).toContain('ADD COLUMN date_kind VARCHAR(16)');
    expect(sql()).toContain('ADD COLUMN date_month SMALLINT');
    expect(sql()).toContain('ADD COLUMN date_day SMALLINT');
    expect(sql()).toContain('ADD COLUMN date_year SMALLINT');
    expect(sql()).toContain("CHECK (date_kind IN ('birthday', 'anniversary'))");
    expect(sql()).toMatch(/chk_people_date_complete CHECK \(\s+\(date_kind IS NULL\) = \(date_month IS NULL\)/);
    expect(sql()).toContain('WHEN date_month = 2 THEN 29 WHEN date_month IN (4, 6, 9, 11) THEN 30 ELSE 31');
    expect(sql()).toContain('date_year % 4 = 0 AND (date_year % 100 <> 0 OR date_year % 400 = 0)');
    expect(sql()).toContain('CREATE INDEX idx_people_user_date ON people(user_id, date_month, date_day) WHERE date_month IS NOT NULL');
  });

  it('drops the index, the checks and the columns', async () => {
    await new PersonDates1787702400000().down(queryRunner);

    expect(sql()).toContain('DROP INDEX IF EXISTS idx_people_user_date');
    expect(sql()).toContain('DROP CONSTRAINT IF EXISTS chk_people_date_year');
    expect(sql()).toContain('DROP COLUMN IF EXISTS date_kind');
    expect(sql()).toContain('DROP COLUMN IF EXISTS date_year');
  });
});
