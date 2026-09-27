import { Controller, Delete, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@/common';
import { FollowStateDto, FollowsResponseDto } from './dto';
import { FollowsService } from './follows.service';

@ApiTags('Social')
@ApiBearerAuth()
@Controller('follows')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get()
  @ApiOperation({ summary: 'List followed users and the follower count' })
  @ApiResponse({
    status: 200,
    description: 'Users followed by the authenticated user and how many follow them',
    type: FollowsResponseDto,
  })
  list(@CurrentUser() user: AuthenticatedUser): Promise<FollowsResponseDto> {
    return this.followsService.list(user.userId);
  }

  @Put(':userId')
  @ApiOperation({ summary: 'Follow an author who has public entries in the feed' })
  @ApiResponse({ status: 200, description: 'The user is followed', type: FollowStateDto })
  @ApiResponse({ status: 400, description: 'Users cannot follow themselves' })
  @ApiResponse({ status: 404, description: 'No followable author with this id' })
  follow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<FollowStateDto> {
    return this.followsService.follow(user.userId, userId);
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Stop following a user' })
  @ApiResponse({ status: 200, description: 'The user is no longer followed', type: FollowStateDto })
  unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<FollowStateDto> {
    return this.followsService.unfollow(user.userId, userId);
  }
}
