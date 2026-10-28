import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Private share links: one entry or one book version, read without signing in through a link whose
 * token only the writer is shown, once. The table keeps the token's SHA-256, an expiry, an optional view
 * limit, and what of the entry the reader sees. A link goes with its entry, book version or writer; an
 * entry moved to the recycle bin or sealed as a time capsule loses its links at once, through a trigger,
 * so no path that bins or seals an entry can leave one readable.
 */
export class ShareLinks1787443200000 implements MigrationInterface {
  name = 'ShareLinks1787443200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE share_links (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        entry_id INTEGER REFERENCES entries(id) ON DELETE CASCADE,
        book_version_id INTEGER REFERENCES book_versions(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL,
        label VARCHAR(80),
        show_mood BOOLEAN NOT NULL DEFAULT false,
        show_tags BOOLEAN NOT NULL DEFAULT false,
        max_views INTEGER,
        view_count INTEGER NOT NULL DEFAULT 0,
        last_viewed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_share_links_target CHECK ((entry_id IS NULL) <> (book_version_id IS NULL)),
        CONSTRAINT chk_share_links_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT chk_share_links_entry_options CHECK (entry_id IS NOT NULL OR (NOT show_mood AND NOT show_tags)),
        CONSTRAINT chk_share_links_max_views CHECK (max_views IS NULL OR max_views BETWEEN 1 AND 1000),
        CONSTRAINT chk_share_links_view_count CHECK (view_count >= 0),
        CONSTRAINT chk_share_links_expiry CHECK (expires_at > created_at)
      );

      CREATE UNIQUE INDEX uq_share_links_token_hash ON share_links(token_hash);
      CREATE INDEX idx_share_links_user_created ON share_links(user_id, created_at);
      CREATE INDEX idx_share_links_entry ON share_links(entry_id) WHERE entry_id IS NOT NULL;
      CREATE INDEX idx_share_links_book_version ON share_links(book_version_id) WHERE book_version_id IS NOT NULL;

      CREATE FUNCTION share_links_drop_for_hidden_entry() RETURNS trigger AS $$
      BEGIN
        DELETE FROM share_links WHERE entry_id = NEW.id;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_entries_drop_share_links
        AFTER UPDATE OF deleted_at, sealed_until ON entries
        FOR EACH ROW
        WHEN ((NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
          OR (NEW.sealed_until IS NOT NULL AND OLD.sealed_until IS NULL))
        EXECUTE FUNCTION share_links_drop_for_hidden_entry();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_entries_drop_share_links ON entries;
      DROP FUNCTION IF EXISTS share_links_drop_for_hidden_entry();
      DROP TABLE IF EXISTS share_links;
    `);
  }
}
