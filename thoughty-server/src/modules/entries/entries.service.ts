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

@Injectable()
export class EntriesService {
  constructor(
    private readonly entriesQueryService: EntriesQueryService,
    private readonly entriesCommandService: EntriesCommandService,
  ) {}

  async getEntries(userId: number, query: GetEntriesQueryDto): Promise<EntriesListResponseDto> {
    return this.entriesQueryService.getEntries(userId, query);
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
    return this.entriesCommandService.create(userId, dto);
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateEntryDto,
  ): Promise<{ success: boolean; entry: Entry }> {
    return this.entriesCommandService.update(userId, id, dto);
  }

  async updateVisibility(
    userId: number,
    id: number,
    visibility: 'public' | 'private',
  ): Promise<{ success: boolean; entry: Entry }> {
    return this.entriesCommandService.updateVisibility(userId, id, visibility);
  }

  async toggleFavorite(
    userId: number,
    id: number,
    isFavorite: boolean,
  ): Promise<{ success: boolean; entry: Entry }> {
    return this.entriesCommandService.toggleFavorite(userId, id, isFavorite);
  }

  async toggleArchived(
    userId: number,
    id: number,
    isArchived: boolean,
  ): Promise<{ success: boolean; entry: Entry }> {
    return this.entriesCommandService.toggleArchived(userId, id, isArchived);
  }

  async togglePinned(
    userId: number,
    id: number,
    isPinned: boolean,
  ): Promise<{ success: boolean; entry: Entry }> {
    return this.entriesCommandService.togglePinned(userId, id, isPinned);
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
    return this.entriesCommandService.deleteAll(userId, diaryId);
  }

  async delete(userId: number, id: number): Promise<{ success: boolean }> {
    return this.entriesCommandService.delete(userId, id);
  }

  async bulkOperation(
    userId: number,
    dto: BulkOperationDto,
  ): Promise<{ success: boolean; affectedCount: number }> {
    return this.entriesCommandService.bulkOperation(userId, dto);
  }

  async renameTag(
    userId: number,
    oldTag: string,
    newTag: string,
  ): Promise<{ success: boolean; affectedCount: number }> {
    return this.entriesCommandService.renameTag(userId, oldTag, newTag);
  }

  async reorderEntries(
    userId: number,
    date: string,
    orderedIds: number[],
  ): Promise<{ success: boolean }> {
    return this.entriesCommandService.reorderEntries(userId, date, orderedIds);
  }

  async getRevisions(userId: number, entryId: number): Promise<EntryRevision[]> {
    return this.entriesQueryService.getRevisions(userId, entryId);
  }

  async deleteRevision(userId: number, entryId: number, revisionId: number): Promise<{ success: boolean }> {
    return this.entriesCommandService.deleteRevision(userId, entryId, revisionId);
  }
}
