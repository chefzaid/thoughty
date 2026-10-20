import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { YearMoodRequestDto, YearMoodResponseDto, YearReviewDto, YearReviewQueryDto } from './dto';
import { YearMoodService } from './year-mood.service';
import { YearReviewService } from './year-review.service';

@ApiTags('Year in review')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('review')
export class ReviewController {
  constructor(
    private readonly yearReviewService: YearReviewService,
    private readonly yearMoodService: YearMoodService,
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
  @ApiResponse({ status: 503, description: 'AI is not available or could not read the year' })
  async readMood(@CurrentUser() user: AuthenticatedUser, @Body() dto: YearMoodRequestDto): Promise<YearMoodResponseDto> {
    return { mood: await this.yearMoodService.generate(user.userId, dto.year, dto.diaryId) };
  }
}
