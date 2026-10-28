import type { QueryRunner } from 'typeorm';
import { ShareLinks1787443200000 } from './migrations/1787443200000-share-links';

describe('ShareLinks1787443200000', () => {
  const queryRunner = { query: jest.fn() } as unknown as QueryRunner;
  const sql = () => (queryRunner.query as jest.Mock).mock.calls[0][0] as string;

  beforeEach(() => jest.clearAllMocks());

  it('creates the links with a hashed token, one target, an expiry and the writer, entry and version cascades', async () => {
    await new ShareLinks1787443200000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain('CREATE TABLE share_links');
    expect(statement).toContain('user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE');
    expect(statement).toContain('entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE');
    expect(statement).toContain('book_version_id INTEGER REFERENCES book_versions(id) ON DELETE CASCADE');
    expect(statement).toContain('token_hash VARCHAR(64) NOT NULL');
    expect(statement).toContain('expires_at TIMESTAMPTZ NOT NULL');
    expect(statement).toContain('CHECK ((entry_id IS NULL) <> (book_version_id IS NULL))');
    expect(statement).toContain("CHECK (token_hash ~ '^[0-9a-f]{64}$')");
    expect(statement).toContain('CHECK (max_views IS NULL OR max_views BETWEEN 1 AND 1000)');
    expect(statement).toContain('CREATE UNIQUE INDEX uq_share_links_token_hash ON share_links(token_hash)');
  });

  it('drops the links of an entry as it goes to the recycle bin or is sealed', async () => {
    await new ShareLinks1787443200000().up(queryRunner);

    const statement = sql();
    expect(statement).toContain('AFTER UPDATE OF deleted_at, sealed_until ON entries');
    expect(statement).toContain('NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL');
    expect(statement).toContain('NEW.sealed_until IS NOT NULL AND OLD.sealed_until IS NULL');
    expect(statement).toContain('DELETE FROM share_links WHERE entry_id = NEW.id');
  });

  it('drops the trigger and its function before the table', async () => {
    await new ShareLinks1787443200000().down(queryRunner);

    const statement = sql();
    const order = [
      'DROP TRIGGER IF EXISTS trg_entries_drop_share_links ON entries',
      'DROP FUNCTION IF EXISTS share_links_drop_for_hidden_entry()',
      'DROP TABLE IF EXISTS share_links',
    ].map((part) => statement.indexOf(part));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
  });
});
