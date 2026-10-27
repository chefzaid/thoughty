import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { StatsService } from './stats.service';
import {
  PersonalityAnalysisRequestDto,
  PersonalityAnalysisResponseDto,
  StatsQueryDto,
  StatsResponseDto,
  WritingStreakResponseDto,
} from './dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { StatsPersonalityAnalysisService } from './stats-personality-analysis.service';
import { StatsStreakService } from './stats-streak.service';

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stats')
export class StatsController {
  constructor(
    private readonly statsService: StatsService,
    private readonly statsPersonalityAnalysisService: StatsPersonalityAnalysisService,
    private readonly statsStreakService: StatsStreakService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get aggregated statistics about journal entries' })
  @ApiResponse({
    status: 200,
    description: 'Statistics object with counts and breakdowns',
    type: StatsResponseDto,
  })
  async getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatsQueryDto,
  ): Promise<StatsResponseDto> {
    return this.statsService.getStats(user.userId, query.diaryId, query.today);
  }

  @Get('streak')
  @ApiOperation({ summary: 'Get the daily writing streak and the last entry, up to the writer’s day' })
  @ApiResponse({
    status: 200,
    description: 'Days in a row with an entry, whether today has one, and the last entry to pick up from',
    type: WritingStreakResponseDto,
  })
  async getStreak(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: StatsQueryDto,
  ): Promise<WritingStreakResponseDto> {
    return this.statsStreakService.getStreak(
      user.userId,
      query.diaryId,
      query.today ?? new Date().toISOString().slice(0, 10),
    );
  }

  @Post('personality-analysis')
  @ApiOperation({ summary: 'Analyze writing tendencies for all entries in a selected scope' })
  @ApiResponse({
    status: 201,
    description: 'Non-clinical personality tendencies derived from aggregate writing statistics',
    type: PersonalityAnalysisResponseDto,
  })
  async analyzePersonality(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PersonalityAnalysisRequestDto,
  ): Promise<PersonalityAnalysisResponseDto> {
    const analysis = await this.statsPersonalityAnalysisService.analyze(user.userId, dto);
    return { analysis };
  }
}
