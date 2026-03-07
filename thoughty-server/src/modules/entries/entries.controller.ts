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
  UpdateVisibilityDto,
  GetEntriesQueryDto,
  GetFirstEntryQueryDto,
  GetEntryByDateQueryDto,
  GetHighlightsQueryDto,
  DeleteAllQueryDto,
  EntriesListResponseDto,
  EntryResponseDto,
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
  @ApiResponse({ status: 200, description: 'Array of dates with entries' })
  async getDates(@CurrentUser() user: AuthenticatedUser): Promise<{ dates: string[] }> {
    return this.entriesService.getDates(user.userId);
  }

  @Get('first')
  @ApiOperation({ summary: 'Get page number containing first entry for a year/month' })
  @ApiResponse({ status: 200, description: 'Page info' })
  async getFirstEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetFirstEntryQueryDto,
  ) {
    return this.entriesService.getFirstEntry(user.userId, query);
  }

  @Get('by-date')
  @ApiOperation({ summary: 'Find an entry by date and optional index' })
  @ApiResponse({ status: 200, description: 'Entry found' })
  async getEntryByDate(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetEntryByDateQueryDto,
  ) {
    return this.entriesService.getEntryByDate(user.userId, query);
  }

  @Get('highlights')
  @ApiOperation({ summary: 'Get random thought and entries from this day in previous years' })
  @ApiResponse({ status: 200, description: 'Highlights data' })
  async getHighlights(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetHighlightsQueryDto,
  ) {
    return this.entriesService.getHighlights(user.userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new entry' })
  @ApiResponse({ status: 201, description: 'Entry created' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEntryDto,
  ): Promise<{ success: boolean }> {
    return this.entriesService.create(user.userId, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Entry updated' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEntryDto,
  ) {
    return this.entriesService.update(user.userId, id, dto);
  }

  @Patch(':id/visibility')
  @ApiOperation({ summary: 'Toggle visibility of an entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Visibility updated' })
  async updateVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVisibilityDto,
  ) {
    return this.entriesService.updateVisibility(user.userId, id, dto.visibility);
  }

  @Delete('all')
  @ApiOperation({ summary: 'Delete all entries (optionally filtered by diary)' })
  @ApiResponse({ status: 200, description: 'Entries deleted' })
  async deleteAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DeleteAllQueryDto,
  ): Promise<{ success: boolean; deletedCount: number }> {
    return this.entriesService.deleteAll(user.userId, query.diaryId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an entry' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Entry deleted' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: boolean }> {
    return this.entriesService.delete(user.userId, id);
  }
}
