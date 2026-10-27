import type { QueryRunner } from 'typeorm';
import { BookVersionSources1786492800000 } from './migrations/1786492800000-book-version-sources';

describe('BookVersionSources1786492800000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('records each version’s source, the journal for the versions made so far', async () => {
    await new BookVersionSources1786492800000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ALTER TABLE book_versions');
    expect(sql).toContain(`ADD COLUMN source JSONB NOT NULL DEFAULT '{"kind":"journal"}'::jsonb`);
    expect(sql).toContain("CHECK (source->>'kind' IN ('journal', 'savedSearch', 'entries'))");
  });

  it('drops the source column and its check', async () => {
    await new BookVersionSources1786492800000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS chk_book_versions_source');
    expect(sql).toContain('DROP COLUMN IF EXISTS source');
  });
});
