import { getMetadataArgsStorage } from 'typeorm';
import { Entry } from './entry.entity';

describe('Entry entity indexes', () => {
  it('declares composite indexes for common journal filters', () => {
    const indexNames = getMetadataArgsStorage()
      .indices.filter((index) => index.target === Entry)
      .map((index) => index.name);

    expect(indexNames).toEqual(
      expect.arrayContaining([
        'idx_entries_user_pinned_date_index',
        'idx_entries_user_diary_date_index',
        'idx_entries_user_visibility_date',
        'idx_entries_user_archive_date',
        'idx_entries_user_favorite_date',
        'idx_entries_public_feed',
        'idx_entries_user_import_ref',
        'idx_entries_user_deleted_at',
      ]),
    );
  });
});

describe('Entry search vector', () => {
  it('is left to PostgreSQL: never selected, inserted, or updated by the application', () => {
    const column = getMetadataArgsStorage().columns.find(
      (candidate) => candidate.target === Entry && candidate.propertyName === 'searchVector',
    );

    expect(column?.options).toEqual(
      expect.objectContaining({ name: 'search_vector', type: 'tsvector', select: false, insert: false, update: false }),
    );
  });
});
