import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import {
  CreateSavedSearchDto,
  RenameSavedSearchDto,
  SavedSearchDeleteResponseDto,
  SavedSearchListResponseDto,
  SavedSearchResponseDto,
} from './dto';
import { SavedSearchesService } from './saved-searches.service';

@ApiTags('Saved searches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('saved-searches')
export class SavedSearchesController {
  constructor(private readonly savedSearchesService: SavedSearchesService) {}

  @Get()
  @ApiOperation({ summary: 'List the writer’s saved journal searches, by name' })
  @ApiResponse({ status: 200, description: 'Saved searches and the limit', type: SavedSearchListResponseDto })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<SavedSearchListResponseDto> {
    return this.savedSearchesService.list(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Save the current journal filters and diary scope under a name' })
  @ApiResponse({ status: 201, description: 'Search saved', type: SavedSearchResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid filters, or the saved search limit is reached' })
  @ApiResponse({ status: 404, description: 'Diary not found' })
  @ApiResponse({ status: 409, description: 'A saved search with this name already exists' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSavedSearchDto,
  ): Promise<SavedSearchResponseDto> {
    return this.savedSearchesService.create(user.userId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a saved search' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Search renamed', type: SavedSearchResponseDto })
  @ApiResponse({ status: 404, description: 'Saved search not found' })
  @ApiResponse({ status: 409, description: 'A saved search with this name already exists' })
  async rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenameSavedSearchDto,
  ): Promise<SavedSearchResponseDto> {
    return this.savedSearchesService.rename(user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved search' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Search deleted', type: SavedSearchDeleteResponseDto })
  @ApiResponse({ status: 404, description: 'Saved search not found' })
  async delete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SavedSearchDeleteResponseDto> {
    return this.savedSearchesService.delete(user.userId, id);
  }
}
