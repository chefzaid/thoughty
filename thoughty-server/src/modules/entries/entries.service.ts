import { Injectable } from '@nestjs/common';
import { EntryRevision } from '@/database/entities';
import {
  CreateEntryDto,
  UpdateEntryDto,
  UpdateEntryTaskDto,
  GetEntriesQueryDto,
  GetFirstEntryQueryDto,
  GetEntryByDateQueryDto,
  GetHighlightsQueryDto,
  GetEntryCalendarQueryDto,
  EntryCalendarResponseDto,
  GetRandomEntryQueryDto,
  RandomEntryResponseDto,
  BulkOperationDto,
  EntriesListResponseDto,
  EntryBacklinksResponseDto,
  EntryHighlightsResponseDto,
  EntryLookupResponseDto,
  EntryMutationResponseDto,
} from './dto';
import { toEntryResponse } from './entry-response.mapper';
import { EntriesQueryService } from './entries-query.service';
import { EntryLookupService } from './entry-lookup.service';
import { EntriesCommandService } from './entries-command.service';
import { EntryListCacheService } from './entry-list-cache.service';
import { EntryTaskListService } from './entry-task-list.service';
import { EntryCalendarService } from './entry-calendar.service';
import { EntryRandomService } from './entry-random.service';
import { TimeCapsuleService } from '@/modules/time-capsules/time-capsules.service';

@Injectable()
export class EntriesService {
  constructor(
    private readonly entriesQueryService: EntriesQueryService,
    private readonly entryLookupService: EntryLookupService,
    private readonly entriesCommandService: EntriesCommandService,
    private readonly entryListCacheService: EntryListCacheService,
    private readonly entryTaskListService: EntryTaskListService,
    private readonly entryCalendarService: EntryCalendarService,
    private readonly entryRandomService: EntryRandomService,
    private readonly timeCapsuleService: TimeCapsuleService,
  ) {}

  async getEntries(userId: number, query: GetEntriesQueryDto): Promise<EntriesListResponseDto> {
    return this.entryListCacheService.getOrLoad(userId, query, () =>
      this.entriesQueryService.getEntries(userId, query),
    );
  }

  async getDates(userId: number): Promise<{ dates: string[] }> {
    return this.entriesQueryService.getDates(userId);
  }

  async getCalendarMonth(userId: number, query: GetEntryCalendarQueryDto): Promise<EntryCalendarResponseDto> {
    return this.entryCalendarService.getMonth(userId, query);
  }

  async getRandomEntry(userId: number, query: GetRandomEntryQueryDto): Promise<RandomEntryResponseDto> {
    return this.entryRandomService.pick(userId, query);
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
    return this.entryLookupService.getFirstEntry(userId, query);
  }

  async getEntryByDate(
    userId: number,
    query: GetEntryByDateQueryDto,
  ): Promise<EntryLookupResponseDto> {
    const { entry, ...result } = await this.entryLookupService.getEntryByDate(userId, query);
    return entry ? { ...result, entry: toEntryResponse(entry) } : result;
  }

  async getBacklinks(userId: number, entryId: number): Promise<EntryBacklinksResponseDto> {
    return this.entryLookupService.getBacklinks(userId, entryId);
  }

  async create(userId: number, dto: CreateEntryDto): Promise<{ success: boolean; entryId: number }> {
    return this.entriesCommandService.create(userId, dto);
  }

  async update(
    userId: number,
    id: number,
    dto: UpdateEntryDto,
  ): Promise<EntryMutationResponseDto> {
    const result = await this.entriesCommandService.update(userId, id, dto);
    return { success: result.success, entry: toEntryResponse(result.entry) };
  }

  async setTask(
    userId: number,
    id: number,
    dto: UpdateEntryTaskDto,
  ): Promise<EntryMutationResponseDto> {
    const result = await this.entryTaskListService.setTask(userId, id, dto);
    return { success: result.success, entry: toEntryResponse(result.entry) };
  }

  async updateVisibility(
    userId: number,
    id: number,
    visibility: 'public' | 'private',
  ): Promise<EntryMutationResponseDto> {
    const result = await this.entriesCommandService.updateVisibility(userId, id, visibility);
    return { success: result.success, entry: toEntryResponse(result.entry) };
  }

  async toggleFavorite(
    userId: number,
    id: number,
    isFavorite: boolean,
  ): Promise<EntryMutationResponseDto> {
    const result = await this.entriesCommandService.toggleFavorite(userId, id, isFavorite);
    return { success: result.success, entry: toEntryResponse(result.entry) };
  }

  async toggleArchived(
    userId: number,
    id: number,
    isArchived: boolean,
  ): Promise<EntryMutationResponseDto> {
    const result = await this.entriesCommandService.toggleArchived(userId, id, isArchived);
    return { success: result.success, entry: toEntryResponse(result.entry) };
  }

  async togglePinned(
    userId: number,
    id: number,
    isPinned: boolean,
  ): Promise<EntryMutationResponseDto> {
    const result = await this.entriesCommandService.togglePinned(userId, id, isPinned);
    return { success: result.success, entry: toEntryResponse(result.entry) };
  }

  /** Opens a sealed time capsule before its date, at the writer's request; nothing is emailed. */
  async unseal(userId: number, id: number): Promise<EntryMutationResponseDto> {
    const entry = await this.timeCapsuleService.openEarly(userId, id);
    return { success: true, entry: toEntryResponse(entry) };
  }

  async getHighlights(userId: number, query: GetHighlightsQueryDto): Promise<EntryHighlightsResponseDto> {
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

  async getTagUsage(userId: number): Promise<{ tags: Array<{ tag: string; count: number }> }> {
    return this.entriesQueryService.getTagUsage(userId);
  }

  async deleteTag(userId: number, tag: string): Promise<{ success: boolean; affectedCount: number }> {
    return this.entriesCommandService.deleteTag(userId, tag);
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
