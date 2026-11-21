import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import {
  WeeklyReflectionQueryDto,
  WeeklyReflectionRequestDto,
  WeeklyReflectionResponseDto,
  WeeklyReflectionStateDto,
  YearMoodRequestDto,
  YearMoodResponseDto,
  YearReviewDto,
  YearReviewQueryDto,
} from './dto';
import { WeeklyReflectionService } from './weekly-reflection.service';
import { YearMoodService } from './year-mood.service';
import { YearReviewService } from './year-review.service';
import { RequireFeature } from '@/common/feature-flags';

@ApiTags('Year in review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(
    private readonly yearReviewService: YearReviewService,
    private readonly yearMoodService: YearMoodService,
    private readonly weeklyReflectionService: WeeklyReflectionService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Recap of one year of writing: totals, rhythm, themes, highlights, and the saved mood arc' })
  @ApiResponse({ status: 200, description: 'The review of that year', type: YearReviewDto })
  @ApiResponse({ status: 404, description: 'Diary not found' })
  async getReview(@CurrentUser() user: AuthenticatedUser, @Query() query: YearReviewQueryDto): Promise<YearReviewDto> {
    return this.yearReviewService.getReview(user.userId, query.year, query.diaryId);
  }

  @Post('mood')
  @HttpCode(200)
  @ApiOperation({ summary: 'Read the mood of each month of the year with AI and keep it with the review' })
  @ApiResponse({ status: 200, description: 'The mood arc, saved with the review', type: YearMoodResponseDto })
  @ApiResponse({ status: 400, description: 'No entries to read in that year' })
  @ApiResponse({ status: 404, description: 'Diary not found' })
  @ApiResponse({ status: 503, description: 'AI is turned off (FEATURE_DISABLED), not available, or could not read the year' })
  @RequireFeature('ai')
  async readMood(@CurrentUser() user: AuthenticatedUser, @Body() dto: YearMoodRequestDto): Promise<YearMoodResponseDto> {
    return { mood: await this.yearMoodService.generate(user.userId, dto.year, dto.diaryId) };
  }

  @Get('week')
  @ApiOperation({ summary: 'The past seven days on the writer’s clock: how many entries a weekly reflection would read, and the one saved for them' })
  @ApiResponse({ status: 200, description: 'The week and its saved reflection, if any', type: WeeklyReflectionStateDto })
  @ApiResponse({ status: 404, description: 'Diary not found' })
  async getWeek(@CurrentUser() user: AuthenticatedUser, @Query() query: WeeklyReflectionQueryDto): Promise<WeeklyReflectionStateDto> {
    return this.weeklyReflectionService.getWeek(user.userId, query.today, query.diaryId);
  }

  @Post('week')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reflect on the past seven days with AI: recurring themes, a short summary and one question for the week ahead, kept until asked again' })
  @ApiResponse({ status: 200, description: 'The reflection, saved for this diary scope', type: WeeklyReflectionResponseDto })
  @ApiResponse({ status: 400, description: 'No entries to read in those seven days' })
  @ApiResponse({ status: 404, description: 'Diary not found' })
  @ApiResponse({ status: 503, description: 'AI is turned off (FEATURE_DISABLED), not available, or could not read the week' })
  @RequireFeature('ai')
  async reflectOnWeek(@CurrentUser() user: AuthenticatedUser, @Body() dto: WeeklyReflectionRequestDto): Promise<WeeklyReflectionResponseDto> {
    return { reflection: await this.weeklyReflectionService.generate(user.userId, dto.today, dto.diaryId) };
  }
}
