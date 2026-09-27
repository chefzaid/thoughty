import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetLeaderboardQueryDto, LeaderboardResponseDto } from './dto';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('Social')
@ApiBearerAuth()
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get()
  @ApiOperation({ summary: 'Rank public authors and entries for a period' })
  @ApiResponse({
    status: 200,
    description: 'Most active authors, most liked entries, and most commented entries',
    type: LeaderboardResponseDto,
  })
  getLeaderboard(@Query() query: GetLeaderboardQueryDto): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getLeaderboard(query.period);
  }
}
