import type { QueryRunner } from 'typeorm';
import { OrphanedSavedSearchBookVersions1786579200000 } from './migrations/1786579200000-orphaned-saved-search-book-versions';

describe('OrphanedSavedSearchBookVersions1786579200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;

  beforeEach(() => jest.clearAllMocks());

  it('deletes the book versions of saved searches that no longer exist for their writer', async () => {
    await new OrphanedSavedSearchBookVersions1786579200000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain('DELETE FROM book_versions version');
    expect(sql).toContain("version.scope_key LIKE 'search:%'");
    expect(sql).toContain('saved.user_id = version.user_id');
    expect(sql).toContain("'search:' || saved.id = version.scope_key");
  });

  it('has nothing to restore', async () => {
    await new OrphanedSavedSearchBookVersions1786579200000().down();

    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
