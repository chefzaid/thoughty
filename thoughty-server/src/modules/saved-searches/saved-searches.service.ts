import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type EntityManager } from 'typeorm';
import { apiError } from '@/common/errors';
import { Diary, SavedSearch, type SavedSearchFilters } from '@/database/entities';
import {
  CreateSavedSearchDto,
  RenameSavedSearchDto,
  SAVED_SEARCH_LIMIT,
  SavedSearchFiltersDto,
  SavedSearchListResponseDto,
  SavedSearchResponseDto,
} from './dto';

/** Namespace of the advisory lock that serializes one writer's saves, so the limit holds under concurrent requests. */
const SAVED_SEARCH_LOCK_NAMESPACE = 'saved_searches';
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class SavedSearchesService {
  constructor(
    @InjectRepository(SavedSearch)
    private readonly savedSearchRepository: Repository<SavedSearch>,
  ) {}

  async list(userId: number): Promise<SavedSearchListResponseDto> {
    const savedSearches = await this.savedSearchRepository
      .createQueryBuilder('saved')
      .where('saved.user_id = :userId', { userId })
      .orderBy('LOWER(saved.name)', 'ASC')
      .addOrderBy('saved.id', 'ASC')
      .getMany();

    return { savedSearches: savedSearches.map((saved) => this.toResponse(saved)), limit: SAVED_SEARCH_LIMIT };
  }

  async create(userId: number, dto: CreateSavedSearchDto): Promise<SavedSearchResponseDto> {
    const saved = await this.withNameCheck(() => this.savedSearchRepository.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1), $2)', [SAVED_SEARCH_LOCK_NAMESPACE, userId]);
      await this.assertOwnDiary(manager, userId, dto.diaryId);

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
    return this.toResponse(await this.withNameCheck(() => this.savedSearchRepository.save(saved)));
  }

  async delete(userId: number, id: number): Promise<{ success: boolean }> {
    const result = await this.savedSearchRepository.delete({ id, userId });
    if (!result.affected) {
      throw apiError(NotFoundException, 'SAVED_SEARCH_NOT_FOUND');
    }
    return { success: true };
  }

  private async assertOwnDiary(manager: EntityManager, userId: number, diaryId: number | null): Promise<void> {
    if (diaryId !== null && !(await manager.getRepository(Diary).exists({ where: { id: diaryId, userId } }))) {
      throw apiError(NotFoundException, 'DIARY_NOT_FOUND');
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
    };
  }

  private toResponse(saved: SavedSearch): SavedSearchResponseDto {
    return {
      id: saved.id,
      name: saved.name,
      diaryId: saved.diaryId,
      filters: saved.filters,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }
}
