import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  @ApiOperation({ summary: 'Get aggregated statistics about journal entries' })
  @ApiQuery({ name: 'diaryId', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Statistics object with counts and breakdowns' })
  async getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('diaryId') diaryId?: string,
  ) {
    const parsedDiaryId = diaryId ? Number.parseInt(diaryId, 10) : undefined;
    return this.statsService.getStats(user.userId, parsedDiaryId);
  }
}
