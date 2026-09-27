import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@/common';
import { AchievementsResponseDto } from './dto';
import { AchievementsService } from './achievements.service';

@ApiTags('Social')
@ApiBearerAuth()
@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievementsService: AchievementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get your karma, activity stats, and badges' })
  @ApiResponse({
    status: 200,
    description: 'Only ever returns the authenticated user’s own achievements',
    type: AchievementsResponseDto,
  })
  getAchievements(@CurrentUser() user: AuthenticatedUser): Promise<AchievementsResponseDto> {
    return this.achievementsService.getAchievements(user.userId);
  }
}
