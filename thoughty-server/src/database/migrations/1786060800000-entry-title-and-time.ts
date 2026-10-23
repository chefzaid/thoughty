import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Entries, and the revisions that keep their earlier versions, get an optional title and an
 * optional time of day. The title joins the full-text search vector with the tags' weight, so
 * the generated column is computed again from a function that also reads the title.
 */
export class EntryTitleAndTime1786060800000 implements MigrationInterface {
  name = 'EntryTitleAndTime1786060800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE entries
        ADD COLUMN title VARCHAR(200),
        ADD COLUMN time_of_day TIME(0);

      ALTER TABLE entry_revisions
        ADD COLUMN title VARCHAR(200),
        ADD COLUMN time_of_day TIME(0);

      CREATE FUNCTION entry_search_vector(title TEXT, content TEXT, tags TEXT[]) RETURNS tsvector
        LANGUAGE sql IMMUTABLE PARALLEL SAFE
        SET search_path FROM CURRENT
        AS $$
          SELECT setweight(to_tsvector('thoughty_en', COALESCE(array_to_string(tags, ' '), '')), 'A')
              || setweight(to_tsvector('thoughty_fr', COALESCE(array_to_string(tags, ' '), '')), 'A')
              || setweight(to_tsvector('thoughty_en', COALESCE(title, '')), 'A')
              || setweight(to_tsvector('thoughty_fr', COALESCE(title, '')), 'A')
              || setweight(to_tsvector('thoughty_en', COALESCE(content, '')), 'B')
              || setweight(to_tsvector('thoughty_fr', COALESCE(content, '')), 'B')
        $$;

      DROP INDEX IF EXISTS idx_entries_user_search_vector;
      ALTER TABLE entries DROP COLUMN search_vector;
      ALTER TABLE entries ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (entry_search_vector(title, content, tags)) STORED;
      CREATE INDEX idx_entries_user_search_vector ON entries USING GIN (user_id, search_vector);

      DROP FUNCTION entry_search_vector(TEXT, TEXT[]);
    `);
  }

  /** Titles and times are dropped; the search vector goes back to content and tags. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION entry_search_vector(content TEXT, tags TEXT[]) RETURNS tsvector
        LANGUAGE sql IMMUTABLE PARALLEL SAFE
        SET search_path FROM CURRENT
        AS $$
          SELECT setweight(to_tsvector('thoughty_en', COALESCE(array_to_string(tags, ' '), '')), 'A')
              || setweight(to_tsvector('thoughty_fr', COALESCE(array_to_string(tags, ' '), '')), 'A')
              || setweight(to_tsvector('thoughty_en', COALESCE(content, '')), 'B')
              || setweight(to_tsvector('thoughty_fr', COALESCE(content, '')), 'B')
        $$;

      DROP INDEX IF EXISTS idx_entries_user_search_vector;
      ALTER TABLE entries DROP COLUMN IF EXISTS search_vector;
      ALTER TABLE entries ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (entry_search_vector(content, tags)) STORED;
      CREATE INDEX idx_entries_user_search_vector ON entries USING GIN (user_id, search_vector);

      DROP FUNCTION IF EXISTS entry_search_vector(TEXT, TEXT, TEXT[]);

      ALTER TABLE entry_revisions
        DROP COLUMN IF EXISTS time_of_day,
        DROP COLUMN IF EXISTS title;

      ALTER TABLE entries
        DROP COLUMN IF EXISTS time_of_day,
        DROP COLUMN IF EXISTS title;
    `);
  }
}
