import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import {
  createPostgresTestDatabase,
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
  type PostgresTestDatabase,
} from '@/database/postgres-test-database.test-helpers';
import { Diary, SavedSearch, User } from '@/database/entities';
import { SAVED_SEARCH_LIMIT } from './dto';
import { SavedSearchesService } from './saved-searches.service';

const filters = {
  search: 'walk',
  searchMode: 'keyword' as const,
  sort: 'relevance' as const,
  tags: ['family'],
  date: '2019-07-14',
  visibility: 'all' as const,
  archiveStatus: 'active' as const,
  favorites: true,
  mood: '4,5',
};

describePostgres('PostgreSQL saved searches', () => {
  let database: PostgresTestDatabase;
  let dataSource: DataSource;
  let service: SavedSearchesService;
  let writerId: number;
  let otherId: number;
  let travel: Diary;

  beforeAll(async () => {
    database = await createPostgresTestDatabase();
    dataSource = database.dataSource;
    service = new SavedSearchesService(dataSource.getRepository(SavedSearch));
  }, POSTGRES_SETUP_TIMEOUT_MS);
  afterAll(async () => { await database?.drop(); });

  beforeEach(async () => {
    await dataSource.query('TRUNCATE users RESTART IDENTITY CASCADE');
    const users = dataSource.getRepository(User);
    writerId = (await users.save({ username: 'writer', email: 'writer@example.com' })).id;
    otherId = (await users.save({ username: 'other', email: 'other@example.com' })).id;
    travel = await dataSource.getRepository(Diary).save({ userId: writerId, name: 'Travel', position: 0 });
  });

  it('keeps each writer’s searches apart, sorted by name whatever its case', async () => {
    await service.create(writerId, { name: 'trips', diaryId: travel.id, filters });
    await service.create(writerId, { name: 'Family', diaryId: null, filters });
    await service.create(otherId, { name: 'Family', diaryId: null, filters });

    const { savedSearches } = await service.list(writerId);
    expect(savedSearches.map((saved) => [saved.name, saved.diaryId])).toEqual([['Family', null], ['trips', travel.id]]);
    expect(savedSearches[0]?.filters).toEqual(filters);
    await expectApiError(service.delete(otherId, savedSearches[0]!.id), NotFoundException, 'SAVED_SEARCH_NOT_FOUND');
    await expectApiError(service.create(otherId, { name: 'Mine', diaryId: travel.id, filters }), NotFoundException, 'DIARY_NOT_FOUND');
  });

  it('allows one name per writer whatever its case, also when renaming', async () => {
    const family = await service.create(writerId, { name: 'Family', diaryId: null, filters });
    const trips = await service.create(writerId, { name: 'Trips', diaryId: null, filters });

    await expectApiError(service.create(writerId, { name: 'FAMILY', diaryId: null, filters }), ConflictException, 'SAVED_SEARCH_NAME_TAKEN');
    await expectApiError(service.rename(writerId, trips.id, { name: 'family' }), ConflictException, 'SAVED_SEARCH_NAME_TAKEN');
    await expect(service.rename(writerId, family.id, { name: 'family' })).resolves.toEqual(expect.objectContaining({ name: 'family' }));
  });

  it('holds the limit under concurrent saves', async () => {
    const values = Array.from({ length: SAVED_SEARCH_LIMIT - 2 }, (_, index) => `($1, 'Search ${index}', '{}')`).join(', ');
    await dataSource.query(`INSERT INTO saved_searches (user_id, name, filters) VALUES ${values}`, [writerId]);

    const results = await Promise.allSettled(
      ['A', 'B', 'C', 'D'].map((name) => service.create(writerId, { name, diaryId: null, filters })),
    );

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    const [{ count }] = await dataSource.query('SELECT COUNT(*)::int AS count FROM saved_searches WHERE user_id = $1', [writerId]);
    expect(count).toBe(SAVED_SEARCH_LIMIT);
    await expectApiError(service.create(writerId, { name: 'E', diaryId: null, filters }), BadRequestException, 'SAVED_SEARCH_LIMIT_REACHED');
  });

  it('widens a search to all diaries when its diary is deleted', async () => {
    const saved = await service.create(writerId, { name: 'Trips', diaryId: travel.id, filters });

    await dataSource.getRepository(Diary).delete({ id: travel.id });

    const { savedSearches } = await service.list(writerId);
    expect(savedSearches).toEqual([expect.objectContaining({ id: saved.id, diaryId: null })]);
  });
});
