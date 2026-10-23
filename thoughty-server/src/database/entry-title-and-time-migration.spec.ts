import type { QueryRunner } from 'typeorm';
import { EntryTitleAndTime1786060800000 } from './migrations/1786060800000-entry-title-and-time';

describe('EntryTitleAndTime1786060800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sqlOf = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('adds an optional title and time of day to entries and their revisions', async () => {
    await new EntryTitleAndTime1786060800000().up(queryRunner);

    const sql = sqlOf();
    expect(sql).toMatch(/ALTER TABLE entries\s+ADD COLUMN title VARCHAR\(200\),\s+ADD COLUMN time_of_day TIME\(0\);/);
    expect(sql).toMatch(/ALTER TABLE entry_revisions\s+ADD COLUMN title VARCHAR\(200\),\s+ADD COLUMN time_of_day TIME\(0\);/);
  });

  it('searches titles with the weight of tags and rebuilds the generated vector and its index', async () => {
    await new EntryTitleAndTime1786060800000().up(queryRunner);

    const sql = sqlOf();
    expect(sql).toMatch(/CREATE FUNCTION entry_search_vector\(title TEXT, content TEXT, tags TEXT\[\]\) RETURNS tsvector\s+LANGUAGE sql IMMUTABLE PARALLEL SAFE\s+SET search_path FROM CURRENT/);
    expect(sql).toContain("setweight(to_tsvector('thoughty_en', COALESCE(title, '')), 'A')");
    expect(sql).toContain("setweight(to_tsvector('thoughty_fr', COALESCE(title, '')), 'A')");
    expect(sql).toContain("setweight(to_tsvector('thoughty_fr', COALESCE(content, '')), 'B')");
    const order = [
      'CREATE FUNCTION entry_search_vector(title TEXT',
      'DROP INDEX IF EXISTS idx_entries_user_search_vector',
      'ALTER TABLE entries DROP COLUMN search_vector',
      'GENERATED ALWAYS AS (entry_search_vector(title, content, tags)) STORED',
      'CREATE INDEX idx_entries_user_search_vector ON entries USING GIN (user_id, search_vector)',
      'DROP FUNCTION entry_search_vector(TEXT, TEXT[])',
    ].map((statement) => sql.indexOf(statement));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });

  it('goes back to the content and tags vector before dropping the new columns', async () => {
    await new EntryTitleAndTime1786060800000().down(queryRunner);

    const sql = sqlOf();
    const order = [
      'CREATE FUNCTION entry_search_vector(content TEXT, tags TEXT[])',
      'ALTER TABLE entries DROP COLUMN IF EXISTS search_vector',
      'GENERATED ALWAYS AS (entry_search_vector(content, tags)) STORED',
      'CREATE INDEX idx_entries_user_search_vector',
      'DROP FUNCTION IF EXISTS entry_search_vector(TEXT, TEXT, TEXT[])',
      'ALTER TABLE entry_revisions',
      'DROP COLUMN IF EXISTS title;',
    ].map((statement) => sql.indexOf(statement));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
    expect(sql).not.toContain("COALESCE(title, '')");
  });
});
