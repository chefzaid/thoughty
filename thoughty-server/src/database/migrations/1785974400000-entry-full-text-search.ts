import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Full-text search over entry content and tags. Each entry keeps a generated `search_vector`
 * that holds its words stemmed both as English and as French, accents removed, with tags
 * weighted above content. A GIN index over the writer and the vector (btree_gin) answers a
 * search from that writer's matching entries only, without reading the rest of the journal.
 */
export class EntryFullTextSearch1785974400000 implements MigrationInterface {
  name = 'EntryFullTextSearch1785974400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS unaccent;
      CREATE EXTENSION IF NOT EXISTS btree_gin;

      CREATE TEXT SEARCH CONFIGURATION thoughty_en (COPY = pg_catalog.english);
      ALTER TEXT SEARCH CONFIGURATION thoughty_en
        ALTER MAPPING FOR hword, hword_part, word WITH unaccent, english_stem;

      CREATE TEXT SEARCH CONFIGURATION thoughty_fr (COPY = pg_catalog.french);
      ALTER TEXT SEARCH CONFIGURATION thoughty_fr
        ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem;

      CREATE FUNCTION entry_search_vector(content TEXT, tags TEXT[]) RETURNS tsvector
        LANGUAGE sql IMMUTABLE PARALLEL SAFE
        SET search_path FROM CURRENT
        AS $$
          SELECT setweight(to_tsvector('thoughty_en', COALESCE(array_to_string(tags, ' '), '')), 'A')
              || setweight(to_tsvector('thoughty_fr', COALESCE(array_to_string(tags, ' '), '')), 'A')
              || setweight(to_tsvector('thoughty_en', COALESCE(content, '')), 'B')
              || setweight(to_tsvector('thoughty_fr', COALESCE(content, '')), 'B')
        $$;

      ALTER TABLE entries ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (entry_search_vector(content, tags)) STORED;

      CREATE INDEX idx_entries_user_search_vector ON entries USING GIN (user_id, search_vector);
    `);
  }

  /** The unaccent and btree_gin extensions stay installed: other objects may rely on them. */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_entries_user_search_vector;
      ALTER TABLE entries DROP COLUMN IF EXISTS search_vector;
      DROP FUNCTION IF EXISTS entry_search_vector(TEXT, TEXT[]);
      DROP TEXT SEARCH CONFIGURATION IF EXISTS thoughty_fr;
      DROP TEXT SEARCH CONFIGURATION IF EXISTS thoughty_en;
    `);
  }
}
