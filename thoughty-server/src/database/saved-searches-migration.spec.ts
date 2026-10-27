import type { QueryRunner } from 'typeorm';
import { SavedSearches1786320000000 } from './migrations/1786320000000-saved-searches';

describe('SavedSearches1786320000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('keeps saved searches per writer with one name each, whatever its case', async () => {
    await new SavedSearches1786320000000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE TABLE saved_searches');
    expect(sql).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(sql).toContain('diary_id INTEGER REFERENCES diaries(id) ON DELETE SET NULL');
    expect(sql).toContain('name VARCHAR(80) NOT NULL');
    expect(sql).toContain('filters JSONB NOT NULL');
    expect(sql).toContain("CHECK (btrim(name) <> '')");
    expect(sql).toContain("CHECK (jsonb_typeof(filters) = 'object')");
    expect(sql).toMatch(/CREATE UNIQUE INDEX uq_saved_searches_user_name ON saved_searches\(user_id, lower\(name\)\)/);
  });

  it('drops the table', async () => {
    await new SavedSearches1786320000000().down(queryRunner);

    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('DROP TABLE IF EXISTS saved_searches');
  });
});
