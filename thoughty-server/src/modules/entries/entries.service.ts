import { Injectable } from '@nestjs/common';
import { Entry, EntryRevision } from '@/database/entities';
import {
  CreateEntryDto,
  UpdateEntryDto,
  GetEntriesQueryDto,
  GetFirstEntryQueryDto,
  GetEntryByDateQueryDto,
  GetHighlightsQueryDto,
  BulkOperationDto,
  EntriesListResponseDto,
  EntryBacklinksResponseDto,
} from './dto';
import { EntriesQueryService } from './entries-query.service';
import { EntriesCommandService } from './entries-command.service';
import { EntryListCacheService } from './entry-list-cache.service';

@Injectable()
export class EntriesService {
  constructor(
    private readonly entriesQueryService: EntriesQueryService,
    private readonly entriesCommandService: EntriesCommandService,
    private readonly entryListCacheService: EntryListCacheService,
  ) {}

  async getEntries(userId: number, query: GetEntriesQueryDto): Promise<EntriesListResponseDto> {
    const cached = this.entryListCacheService.get(userId, query);
    if (cached) {
      return cached;
    }

    const result = await this.entriesQueryService.getEntries(userId, query);
    this.entryListCacheService.set(userId, query, result);
    return result;
  }

  async getDates(userId: number): Promise<{ dates: string[] }> {
    return this.entriesQueryService.getDates(userId);
  }

  async getFirstEntry(
    userId: number,
    query: GetFirstEntryQueryDto,
  ): Promise<{
    page: number;
    found: boolean;
    entryId?: number;
    years: number[];
    months: string[];
  }> {
    return this.entriesQueryService.getFirstEntry(userId, query);
  }

  async getEntryByDate(
    userId: number,
    query: GetEntryByDateQueryDto,
  ): Promise<{
    found: boolean;
    entry?: Entry;
    page?: number;
    entryId?: number;
    error?: string;
  }> {
    return this.entriesQueryService.getEntryByDate(userId, query);
  }

  async getBacklinks(userId: number, entryId: number): Promise<EntryBacklinksResponseDto> {
    return this.entriesQueryService.getBacklinks(userId, entryId);
  }

  async create(userId: number, dto: CreateEntryDto): Promise<{ success: boolean; entryId: number }> {
    const result = await this.entriesCommandService.create(userId, dto);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateEntryDto,
  ): Promise<{ success: boolean; entry: Entry }> {
    const result = await this.entriesCommandService.update(userId, id, dto);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async updateVisibility(
    userId: number,
    id: number,
    visibility: 'public' | 'private',
  ): Promise<{ success: boolean; entry: Entry }> {
    const result = await this.entriesCommandService.updateVisibility(userId, id, visibility);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async toggleFavorite(
    userId: number,
    id: number,
    isFavorite: boolean,
  ): Promise<{ success: boolean; entry: Entry }> {
    const result = await this.entriesCommandService.toggleFavorite(userId, id, isFavorite);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async toggleArchived(
    userId: number,
    id: number,
    isArchived: boolean,
  ): Promise<{ success: boolean; entry: Entry }> {
    const result = await this.entriesCommandService.toggleArchived(userId, id, isArchived);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async togglePinned(
    userId: number,
    id: number,
    isPinned: boolean,
  ): Promise<{ success: boolean; entry: Entry }> {
    const result = await this.entriesCommandService.togglePinned(userId, id, isPinned);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async getHighlights(
    userId: number,
    query: GetHighlightsQueryDto,
  ): Promise<{
    randomEntry: Entry | null;
    onThisDay: Record<number, Entry[]>;
    currentDate: { month: string; day: string; year: number };
  }> {
    return this.entriesQueryService.getHighlights(userId, query);
  }

  async deleteAll(userId: number, diaryId?: number): Promise<{ success: boolean; deletedCount: number }> {
    const result = await this.entriesCommandService.deleteAll(userId, diaryId);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async delete(userId: number, id: number): Promise<{ success: boolean }> {
    const result = await this.entriesCommandService.delete(userId, id);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async bulkOperation(
    userId: number,
    dto: BulkOperationDto,
  ): Promise<{ success: boolean; affectedCount: number }> {
    const result = await this.entriesCommandService.bulkOperation(userId, dto);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async renameTag(
    userId: number,
    oldTag: string,
    newTag: string,
  ): Promise<{ success: boolean; affectedCount: number }> {
    const result = await this.entriesCommandService.renameTag(userId, oldTag, newTag);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async reorderEntries(
    userId: number,
    date: string,
    orderedIds: number[],
  ): Promise<{ success: boolean }> {
    const result = await this.entriesCommandService.reorderEntries(userId, date, orderedIds);
    this.entryListCacheService.invalidateUser(userId);
    return result;
  }

  async getRevisions(userId: number, entryId: number): Promise<EntryRevision[]> {
    return this.entriesQueryService.getRevisions(userId, entryId);
  }

  async deleteRevision(userId: number, entryId: number, revisionId: number): Promise<{ success: boolean }> {
    return this.entriesCommandService.deleteRevision(userId, entryId, revisionId);
  }
}
