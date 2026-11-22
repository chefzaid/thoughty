import type { QueryRunner } from 'typeorm';
import { PersonImportantDates1789689600000 } from './migrations/1789689600000-person-important-dates';

describe('PersonImportantDates1789689600000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('creates the dates table with the old checks and one birthday a person, moves each date there and drops the old columns', async () => {
    await new PersonImportantDates1789689600000().up(queryRunner);

    expect(sql()).toContain('CREATE TABLE person_dates');
    expect(sql()).toContain('person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE');
    expect(sql()).toContain('label VARCHAR(40)');
    expect(sql()).toContain("CONSTRAINT chk_person_dates_kind CHECK (kind IN ('birthday', 'anniversary'))");
    expect(sql()).toContain("CONSTRAINT chk_person_dates_label CHECK (label <> '')");
    expect(sql()).toContain('WHEN month = 2 THEN 29 WHEN month IN (4, 6, 9, 11) THEN 30 ELSE 31');
    expect(sql()).toContain('year % 4 = 0 AND (year % 100 <> 0 OR year % 400 = 0)');
    expect(sql()).toContain("CREATE UNIQUE INDEX uq_person_dates_birthday ON person_dates(person_id) WHERE kind = 'birthday'");
    expect(sql()).toContain('CREATE INDEX idx_person_dates_day ON person_dates(month, day)');
    expect(sql()).toMatch(/INSERT INTO person_dates \(person_id, kind, month, day, year\)\s+SELECT id, date_kind, date_month, date_day, date_year FROM people WHERE date_month IS NOT NULL/);
    expect(sql()).toContain('DROP INDEX IF EXISTS idx_people_user_date');
    expect(sql()).toContain('DROP COLUMN IF EXISTS date_kind');
    expect(sql().indexOf('INSERT INTO person_dates')).toBeLessThan(sql().indexOf('DROP COLUMN IF EXISTS date_kind'));
  });

  it('puts the columns back with one date each, the birthday first, then drops the table', async () => {
    await new PersonImportantDates1789689600000().down(queryRunner);

    expect(sql()).toContain('ADD COLUMN date_kind VARCHAR(16)');
    expect(sql()).toContain('ADD CONSTRAINT chk_people_date_complete CHECK');
    expect(sql()).toContain("ORDER BY person_id, kind <> 'birthday', month, day, id");
    expect(sql()).toContain('CREATE INDEX idx_people_user_date ON people(user_id, date_month, date_day) WHERE date_month IS NOT NULL');
    expect(sql()).toContain('DROP TABLE IF EXISTS person_dates');
    expect(sql().indexOf('UPDATE people p SET date_kind')).toBeLessThan(sql().indexOf('DROP TABLE IF EXISTS person_dates'));
  });
});
