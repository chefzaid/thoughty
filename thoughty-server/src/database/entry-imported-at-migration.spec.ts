import type { QueryRunner } from 'typeorm';
import { EntryImportedAt1790294400000 } from './migrations/1790294400000-entry-imported-at';

describe('EntryImportedAt1790294400000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('adds an optional import time and marks the entries an app import made, from their creation time', async () => {
    await new EntryImportedAt1790294400000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('ALTER TABLE entries ADD COLUMN imported_at TIMESTAMPTZ;');
    expect(sql).toContain('UPDATE entries SET imported_at = created_at WHERE import_ref IS NOT NULL');
    expect(sql.indexOf('ADD COLUMN imported_at')).toBeLessThan(sql.indexOf('UPDATE entries'));
  });

  it('drops the column', async () => {
    await new EntryImportedAt1790294400000().down(queryRunner);

    expect((queryRunner.query as jest.Mock).mock.calls[0][0]).toContain('ALTER TABLE entries DROP COLUMN IF EXISTS imported_at');
  });
});
