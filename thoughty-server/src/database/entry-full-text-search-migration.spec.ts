import type { QueryRunner } from 'typeorm';
import { EntryFullTextSearch1785974400000 } from './migrations/1785974400000-entry-full-text-search';

describe('EntryFullTextSearch1785974400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('creates accent-insensitive English and French configurations', async () => {
    await new EntryFullTextSearch1785974400000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS unaccent');
    expect(sql).toMatch(/CREATE TEXT SEARCH CONFIGURATION thoughty_en \(COPY = pg_catalog\.english\)/);
    expect(sql).toMatch(/ALTER MAPPING FOR hword, hword_part, word WITH unaccent, english_stem/);
    expect(sql).toMatch(/CREATE TEXT SEARCH CONFIGURATION thoughty_fr \(COPY = pg_catalog\.french\)/);
    expect(sql).toMatch(/ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem/);
  });

  it('generates a weighted search vector over tags and content and indexes it per writer', async () => {
    await new EntryFullTextSearch1785974400000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toMatch(/CREATE FUNCTION entry_search_vector\(content TEXT, tags TEXT\[\]\) RETURNS tsvector\s+LANGUAGE sql IMMUTABLE PARALLEL SAFE\s+SET search_path FROM CURRENT/);
    expect(sql).toContain("setweight(to_tsvector('thoughty_en', COALESCE(array_to_string(tags, ' '), '')), 'A')");
    expect(sql).toContain("setweight(to_tsvector('thoughty_fr', COALESCE(content, '')), 'B')");
    expect(sql).toMatch(/ADD COLUMN search_vector tsvector\s+GENERATED ALWAYS AS \(entry_search_vector\(content, tags\)\) STORED/);
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS btree_gin');
    expect(sql).toContain('CREATE INDEX idx_entries_user_search_vector ON entries USING GIN (user_id, search_vector)');
  });

  it('drops the index and column before the function and configurations they use', async () => {
    await new EntryFullTextSearch1785974400000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    const order = [
      'DROP INDEX IF EXISTS idx_entries_user_search_vector',
      'DROP COLUMN IF EXISTS search_vector',
      'DROP FUNCTION IF EXISTS entry_search_vector(TEXT, TEXT[])',
      'DROP TEXT SEARCH CONFIGURATION IF EXISTS thoughty_fr',
      'DROP TEXT SEARCH CONFIGURATION IF EXISTS thoughty_en',
    ].map((statement) => sql.indexOf(statement));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
    expect(sql).not.toContain('DROP EXTENSION');
  });
});
