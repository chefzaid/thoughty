import { Body, Controller, Delete, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import {
  RecycleBinDeleteResponseDto,
  RecycleBinListResponseDto,
  RecycleBinQueryDto,
  RecycleBinRestoreResponseDto,
  RecycleBinSelectionDto,
} from './dto';
import { RecycleBinService } from './recycle-bin.service';

@ApiTags('Recycle bin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recycle-bin')
export class RecycleBinController {
  constructor(private readonly recycleBinService: RecycleBinService) {}

  @Get()
  @ApiOperation({ summary: 'List deleted entries kept for 30 days, most recently deleted first' })
  @ApiResponse({ status: 200, description: 'A page of the recycle bin', type: RecycleBinListResponseDto })
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: RecycleBinQueryDto): Promise<RecycleBinListResponseDto> {
    return this.recycleBinService.list(user.userId, query.page, query.limit);
  }

  @Post('restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore entries to their diary, or to the default diary when theirs is gone' })
  @ApiResponse({ status: 200, description: 'Entries restored', type: RecycleBinRestoreResponseDto })
  @ApiResponse({ status: 404, description: 'None of the entries are in the recycle bin' })
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecycleBinSelectionDto,
  ): Promise<RecycleBinRestoreResponseDto> {
    return this.recycleBinService.restore(user.userId, dto.ids);
  }

  @Post('restore-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restore every entry in the recycle bin' })
  @ApiResponse({ status: 200, description: 'Entries restored', type: RecycleBinRestoreResponseDto })
  @ApiResponse({ status: 404, description: 'The recycle bin is empty' })
  async restoreAll(@CurrentUser() user: AuthenticatedUser): Promise<RecycleBinRestoreResponseDto> {
    return this.recycleBinService.restore(user.userId);
  }

  @Post('delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Delete entries from the recycle bin for good, with their history and files' })
  @ApiResponse({ status: 200, description: 'Entries deleted permanently', type: RecycleBinDeleteResponseDto })
  @ApiResponse({ status: 404, description: 'None of the entries are in the recycle bin' })
  async deletePermanently(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecycleBinSelectionDto,
  ): Promise<RecycleBinDeleteResponseDto> {
    return { success: true, deletedCount: await this.recycleBinService.deletePermanently(user.userId, dto.ids) };
  }

  @Delete()
  @ApiOperation({ summary: 'Empty the recycle bin' })
  @ApiResponse({ status: 200, description: 'Recycle bin emptied', type: RecycleBinDeleteResponseDto })
  async empty(@CurrentUser() user: AuthenticatedUser): Promise<RecycleBinDeleteResponseDto> {
    return { success: true, deletedCount: await this.recycleBinService.deletePermanently(user.userId) };
  }
}
