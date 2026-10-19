import type { QueryRunner } from 'typeorm';
import { EntryImportRefs1785715200000 } from './migrations/1785715200000-entry-import-refs';

describe('EntryImportRefs1785715200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('adds an optional import reference that is unique per writer', async () => {
    await new EntryImportRefs1785715200000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ALTER TABLE entries ADD COLUMN import_ref VARCHAR(120)');
    expect(sql).toMatch(/CREATE UNIQUE INDEX idx_entries_user_import_ref\s+ON entries\(user_id, import_ref\)\s+WHERE import_ref IS NOT NULL/);
  });

  it('drops the index before the column', async () => {
    await new EntryImportRefs1785715200000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql.indexOf('DROP INDEX IF EXISTS idx_entries_user_import_ref')).toBeLessThan(
      sql.indexOf('DROP COLUMN IF EXISTS import_ref'),
    );
  });
});
