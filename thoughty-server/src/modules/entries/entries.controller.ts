import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { EntriesService } from './entries.service';
import {
  CreateEntryDto,
  UpdateEntryDto,
  UpdateEntryTaskDto,
  UpdateVisibilityDto,
  UpdateFavoriteDto,
  UpdateArchivedDto,
  UpdatePinnedDto,
  BulkOperationDto,
  RenameTagDto,
  DeleteTagQueryDto,
  TagUsageListResponseDto,
  ReorderEntriesDto,
  GetEntriesQueryDto,
  GetFirstEntryQueryDto,
  GetEntryByDateQueryDto,
  GetHighlightsQueryDto,
  GetEntryCalendarQueryDto,
  EntryCalendarResponseDto,
  DeleteAllQueryDto,
  EntriesListResponseDto,
  EntryDatesResponseDto,
  FirstEntryResponseDto,
  EntryLookupResponseDto,
  EntryBacklinksResponseDto,
  CreateEntryResponseDto,
  EntryMutationResponseDto,
  CountedMutationResponseDto,
  DeleteAllResponseDto,
  SuccessResponseDto,
  EntryHighlightsResponseDto,
} from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';

@ApiTags('Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('entries')
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all entries with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'List of entries', type: EntriesListResponseDto })
  async getEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetEntriesQueryDto,
  ): Promise<EntriesListResponseDto> {
    return this.entriesService.getEntries(user.userId, query);
  }

  @Get('dates')
  @ApiOperation({ summary: 'Get all distinct dates that have entries' })
  @ApiResponse({
    status: 200,
    description: 'Array of dates with entries',
    type: EntryDatesResponseDto,
  })
  async getDates(@CurrentUser() user: AuthenticatedUser): Promise<{ dates: string[] }> {
    return this.entriesService.getDates(user.userId);
  }

  @Get('calendar')
  @ApiOperation({
    summary: "A month's entries for the journal calendar",
    description:
      'Short summaries (title, the start of the text, time of day and mood) of the entries of one month that ' +
      'match the journal filters, by day and in each day\'s order. Entries in the recycle bin are left out.',
  })
  @ApiResponse({ status: 200, description: "The month's entries", type: EntryCalendarResponseDto })
  @ApiResponse({ status: 400, description: 'The month is not YYYY-MM, or a filter is invalid' })
  async getCalendarMonth(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetEntryCalendarQueryDto,
  ): Promise<EntryCalendarResponseDto> {
    return this.entriesService.getCalendarMonth(user.userId, query);
  }

  @Get('first')
  @ApiOperation({ summary: 'Get page number containing first entry for a year/month' })
  @ApiResponse({ status: 200, description: 'Page info', type: FirstEntryResponseDto })
  async getFirstEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetFirstEntryQueryDto,
  ) {
    return this.entriesService.getFirstEntry(user.userId, query);
  }

  @Get('by-date')
  @ApiOperation({ summary: 'Find an entry by date and optional index' })
  @ApiResponse({ status: 200, description: 'Entry found', type: EntryLookupResponseDto })
  async getEntryByDate(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetEntryByDateQueryDto,
  ) {
    return this.entriesService.getEntryByDate(user.userId, query);
  }

  @Get('highlights')
  @ApiOperation({ summary: 'Get random thought and entries from this day in previous years' })
  @ApiResponse({ status: 200, description: 'Highlights data', type: EntryHighlightsResponseDto })
  async getHighlights(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetHighlightsQueryDto,
  ): Promise<EntryHighlightsResponseDto> {
    return this.entriesService.getHighlights(user.userId, query);
  }

  @Get('tags')
  @ApiOperation({ summary: "List the current user's tags with entry counts" })
  @ApiResponse({ status: 200, description: 'Tag usage', type: TagUsageListResponseDto })
  async getTagUsage(@CurrentUser() user: AuthenticatedUser): Promise<TagUsageListResponseDto> {
    return this.entriesService.getTagUsage(user.userId);
  }

  @Get(':id/backlinks')
  @ApiOperation({ summary: 'Get entries that reference this entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Entries referencing this entry',
    type: EntryBacklinksResponseDto,
  })
  async getBacklinks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<EntryBacklinksResponseDto> {
    return this.entriesService.getBacklinks(user.userId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new entry' })
  @ApiResponse({ status: 201, description: 'Entry created', type: CreateEntryResponseDto })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEntryDto,
  ): Promise<CreateEntryResponseDto> {
    return this.entriesService.create(user.userId, dto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Perform bulk operations on entries' })
  @ApiResponse({
    status: 200,
    description: 'Bulk operation completed',
    type: CountedMutationResponseDto,
  })
  async bulkOperation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: BulkOperationDto,
  ): Promise<CountedMutationResponseDto> {
    return this.entriesService.bulkOperation(user.userId, dto);
  }

  @Patch('tags/rename')
  @ApiOperation({ summary: "Rename a tag across all of the current user's entries" })
  @ApiResponse({
    status: 200,
    description: 'Tag renamed across entries',
    type: CountedMutationResponseDto,
  })
  async renameTag(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RenameTagDto,
  ): Promise<CountedMutationResponseDto> {
    return this.entriesService.renameTag(user.userId, dto.oldTag, dto.newTag);
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder entries within a single day' })
  @ApiResponse({ status: 200, description: 'Entries reordered', type: SuccessResponseDto })
  async reorderEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReorderEntriesDto,
  ): Promise<SuccessResponseDto> {
    return this.entriesService.reorderEntries(user.userId, dto.date, dto.orderedIds);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Entry updated', type: EntryMutationResponseDto })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEntryDto,
  ) {
    return this.entriesService.update(user.userId, id, dto);
  }

  @Patch(':id/tasks')
  @ApiOperation({
    summary: 'Tick or untick a task list item of a Markdown entry',
    description:
      'Sets the task on one line of the entry text (`- [ ]` or `- [x]`) as done or not, and changes nothing ' +
      'else. The previous version goes to the revision history, except when the latest revision is under ten ' +
      'minutes old and the entry has changed since only in its ticks, so a run of ticks keeps one revision.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Task updated', type: EntryMutationResponseDto })
  @ApiResponse({ status: 400, description: 'The entry is not Markdown' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  @ApiResponse({ status: 409, description: 'The line is not a task list item (the entry changed elsewhere)' })
  async setTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEntryTaskDto,
  ) {
    return this.entriesService.setTask(user.userId, id, dto);
  }

  @Patch(':id/visibility')
  @ApiOperation({ summary: 'Toggle visibility of an entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Visibility updated', type: EntryMutationResponseDto })
  async updateVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVisibilityDto,
  ) {
    return this.entriesService.updateVisibility(user.userId, id, dto.visibility);
  }

  @Patch(':id/favorite')
  @ApiOperation({ summary: 'Toggle favorite status of an entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Favorite status updated',
    type: EntryMutationResponseDto,
  })
  async toggleFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFavoriteDto,
  ) {
    return this.entriesService.toggleFavorite(user.userId, id, dto.isFavorite);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Toggle archive status of an entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Archive status updated',
    type: EntryMutationResponseDto,
  })
  async toggleArchived(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateArchivedDto,
  ) {
    return this.entriesService.toggleArchived(user.userId, id, dto.isArchived);
  }

  @Patch(':id/pinned')
  @ApiOperation({ summary: 'Toggle pinned status of an entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Pinned status updated',
    type: EntryMutationResponseDto,
  })
  async togglePinned(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePinnedDto,
  ) {
    return this.entriesService.togglePinned(user.userId, id, dto.isPinned);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get revision history for an entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Entry revision history' })
  async getHistory(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.entriesService.getRevisions(user.userId, id);
  }

  @Delete(':id/history/:revisionId')
  @ApiOperation({ summary: 'Delete a specific revision from entry history' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'revisionId', type: Number })
  @ApiResponse({ status: 200, description: 'Revision deleted', type: SuccessResponseDto })
  async deleteRevision(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('revisionId', ParseIntPipe) revisionId: number,
  ): Promise<SuccessResponseDto> {
    return this.entriesService.deleteRevision(user.userId, id, revisionId);
  }

  @Delete('all')
  @ApiOperation({ summary: 'Delete all entries (optionally filtered by diary)' })
  @ApiResponse({ status: 200, description: 'Entries deleted', type: DeleteAllResponseDto })
  async deleteAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DeleteAllQueryDto,
  ): Promise<DeleteAllResponseDto> {
    return this.entriesService.deleteAll(user.userId, query.diaryId);
  }

  @Delete('tags')
  @ApiOperation({ summary: "Remove a tag from all of the current user's entries" })
  @ApiResponse({ status: 200, description: 'Tag removed from entries', type: CountedMutationResponseDto })
  async deleteTag(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DeleteTagQueryDto,
  ): Promise<CountedMutationResponseDto> {
    return this.entriesService.deleteTag(user.userId, query.tag);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Entry deleted', type: SuccessResponseDto })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SuccessResponseDto> {
    return this.entriesService.delete(user.userId, id);
  }
}
