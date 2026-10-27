import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { apiError } from '@/common/errors';
import { BookVersion, Diary, LifeEra, SavedSearch, type SavedSearchFilters } from '@/database/entities';
import {
  CreateSavedSearchDto,
  RenameSavedSearchDto,
  SAVED_SEARCH_LIMIT,
  SavedSearchFiltersDto,
  SavedSearchListResponseDto,
  SavedSearchResponseDto,
} from './dto';
import { lockBookVersionHistory, savedSearchBookScopeKey } from './saved-search-book-versions';

/** Namespace of the advisory lock that serializes one writer's saves, so the limit holds under concurrent requests. */
const SAVED_SEARCH_LOCK_NAMESPACE = 'saved_searches';
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class SavedSearchesService {
  constructor(
    @InjectRepository(SavedSearch)
    private readonly savedSearchRepository: Repository<SavedSearch>,
    @InjectRepository(BookVersion)
    private readonly bookVersionRepository: Repository<BookVersion>,
  ) {}

  async list(userId: number): Promise<SavedSearchListResponseDto> {
    const savedSearches = await this.savedSearchRepository
      .createQueryBuilder('saved')
      .where('saved.user_id = :userId', { userId })
      .orderBy('LOWER(saved.name)', 'ASC')
      .addOrderBy('saved.id', 'ASC')
      .getMany();

    const counts = await this.bookVersionCounts(userId, savedSearches.map((saved) => saved.id));
    return {
      savedSearches: savedSearches.map((saved) => this.toResponse(saved, counts.get(saved.id))),
      limit: SAVED_SEARCH_LIMIT,
    };
  }

  async create(userId: number, dto: CreateSavedSearchDto): Promise<SavedSearchResponseDto> {
    const saved = await this.withNameCheck(() => this.savedSearchRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [SAVED_SEARCH_LOCK_NAMESPACE, userId]);
      await this.assertOwnDiary(manager, userId, dto.diaryId);
      await this.assertOwnEra(manager, userId, dto.filters.eraId ?? null);

      const repository = manager.getRepository(SavedSearch);
      if (await repository.count({ where: { userId } }) >= SAVED_SEARCH_LIMIT) {
        throw apiError(
          BadRequestException,
          'SAVED_SEARCH_LIMIT_REACHED',
          `Saved search limit reached (${SAVED_SEARCH_LIMIT})`,
        );
      }

      return repository.save(repository.create({
        userId,
        name: dto.name,
        diaryId: dto.diaryId,
        filters: this.toFilters(dto.filters),
      }));
    }));

    return this.toResponse(saved);
  }

  /** One of the writer's saved searches, refused when it is not theirs. */
  async findOwn(userId: number, id: number): Promise<SavedSearch> {
    const saved = await this.savedSearchRepository.findOne({ where: { id, userId } });
    if (!saved) {
      throw apiError(NotFoundException, 'SAVED_SEARCH_NOT_FOUND');
    }
    return saved;
  }

  async rename(userId: number, id: number, dto: RenameSavedSearchDto): Promise<SavedSearchResponseDto> {
    const saved = await this.findOwn(userId, id);
    saved.name = dto.name;
    const [renamed, counts] = await Promise.all([
      this.withNameCheck(() => this.savedSearchRepository.save(saved)),
      this.bookVersionCounts(userId, [id]),
    ]);
    return this.toResponse(renamed, counts.get(id));
  }

  /**
   * Deletes a saved search with the book versions built from it, which no screen could list once
   * it is gone. Holding the history's lock keeps a version saved at the same moment from outliving it.
   */
  async delete(userId: number, id: number): Promise<{ success: boolean }> {
    await this.savedSearchRepository.manager.transaction(async (manager) => {
      const scopeKey = savedSearchBookScopeKey(id);
      await lockBookVersionHistory(manager, userId, scopeKey);
      const result = await manager.getRepository(SavedSearch).delete({ id, userId });
      if (!result.affected) {
        throw apiError(NotFoundException, 'SAVED_SEARCH_NOT_FOUND');
      }
      await manager.getRepository(BookVersion).delete({ userId, scopeKey });
    });
    return { success: true };
  }

  /** How many book versions each of the given saved searches holds; those with none are left out. */
  private async bookVersionCounts(userId: number, ids: number[]): Promise<Map<number, number>> {
    if (ids.length === 0) {
      return new Map();
    }
    const scopeKeys = new Map(ids.map((id) => [savedSearchBookScopeKey(id), id]));
    const rows = await this.bookVersionRepository
      .createQueryBuilder('version')
      .select('version.scope_key', 'scopeKey')
      .addSelect('COUNT(*)::int', 'count')
      .where('version.user_id = :userId', { userId })
      .andWhere('version.scope_key IN (:...scopeKeys)', { scopeKeys: [...scopeKeys.keys()] })
      .groupBy('version.scope_key')
      .getRawMany<{ scopeKey: string; count: number }>();
    return new Map(rows.map((row) => [scopeKeys.get(row.scopeKey)!, Number(row.count)]));
  }

  private async assertOwnDiary(manager: EntityManager, userId: number, diaryId: number | null): Promise<void> {
    if (diaryId !== null && !(await manager.getRepository(Diary).exists({ where: { id: diaryId, userId } }))) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
    }
  }

  private async assertOwnEra(manager: EntityManager, userId: number, eraId: number | null): Promise<void> {
    if (eraId !== null && !(await manager.getRepository(LifeEra).exists({ where: { id: eraId, userId } }))) {
      throw apiError(NotFoundException, 'LIFE_ERA_NOT_FOUND');
    }
  }

  /** Runs a write and turns a clash with another saved search's name (in any case) into a coded conflict. */
  private async withNameCheck<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error: unknown) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw apiError(ConflictException, 'SAVED_SEARCH_NAME_TAKEN');
      }
      throw error;
    }
  }

  /** Only the known filter fields, with each tag once. */
  private toFilters(filters: SavedSearchFiltersDto): SavedSearchFilters {
    return {
      search: filters.search,
      searchMode: filters.searchMode,
      sort: filters.sort,
      tags: [...new Set(filters.tags)],
      date: filters.date,
      visibility: filters.visibility,
      archiveStatus: filters.archiveStatus,
      favorites: filters.favorites,
      mood: filters.mood,
      eraId: filters.eraId ?? null,
    };
  }

  private toResponse(saved: SavedSearch, bookVersionCount = 0): SavedSearchResponseDto {
    return {
      id: saved.id,
      name: saved.name,
      diaryId: saved.diaryId,
      // Searches saved before life eras have no era: they cover every date
      filters: { ...saved.filters, eraId: saved.filters.eraId ?? null },
      bookVersionCount,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }
}
