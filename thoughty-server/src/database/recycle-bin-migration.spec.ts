import type { QueryRunner } from 'typeorm';
import { RecycleBin1785888000000 } from './migrations/1785888000000-recycle-bin';

describe('RecycleBin1785888000000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('marks trashed entries with a deletion time and indexes the bin per writer', async () => {
    await new RecycleBin1785888000000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ALTER TABLE entries ADD COLUMN deleted_at TIMESTAMPTZ');
    expect(sql).toMatch(/CREATE INDEX idx_entries_user_deleted_at\s+ON entries\(user_id, deleted_at\)\s+WHERE deleted_at IS NOT NULL/);
  });

  it('keeps import references unique only outside the bin', async () => {
    await new RecycleBin1785888000000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql.indexOf('DROP INDEX IF EXISTS idx_entries_user_import_ref')).toBeLessThan(
      sql.indexOf('CREATE UNIQUE INDEX idx_entries_user_import_ref'),
    );
    expect(sql).toMatch(/ON entries\(user_id, import_ref\)\s+WHERE import_ref IS NOT NULL AND deleted_at IS NULL/);
  });

  it('removes trashed entries before restoring the previous index and dropping the column', async () => {
    await new RecycleBin1785888000000().down(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql.indexOf('DELETE FROM entries WHERE deleted_at IS NOT NULL')).toBeLessThan(
      sql.indexOf('CREATE UNIQUE INDEX idx_entries_user_import_ref'),
    );
    expect(sql).toMatch(/ON entries\(user_id, import_ref\)\s+WHERE import_ref IS NOT NULL;/);
    expect(sql.indexOf('DROP INDEX IF EXISTS idx_entries_user_deleted_at')).toBeLessThan(
      sql.indexOf('DROP COLUMN IF EXISTS deleted_at'),
    );
  });
});
