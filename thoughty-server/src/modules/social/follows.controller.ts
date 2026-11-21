import { Controller, Delete, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, RATE_LIMITS, throttleDefault } from '@/common';
import { FollowStateDto, FollowsResponseDto, TopicFollowStateDto, TopicParamDto } from './dto';
import { FollowsService } from './follows.service';
import { TopicFollowsService } from './topic-follows.service';
import { RequireFeature } from '@/common/feature-flags';

@ApiTags('Social')
@ApiBearerAuth()
@RequireFeature('publicSharing')
@Controller('follows')
export class FollowsController {
  constructor(
    private readonly followsService: FollowsService,
    private readonly topicFollowsService: TopicFollowsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List followed users and topics, and the followers' })
  @ApiResponse({
    status: 200,
    description: 'Users and topics followed by the authenticated user, and who follows them',
    type: FollowsResponseDto,
  })
  list(@CurrentUser() user: AuthenticatedUser): Promise<FollowsResponseDto> {
    return this.followsService.list(user.userId);
  }

  @Put(':userId')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
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
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Stop following a user' })
  @ApiResponse({ status: 200, description: 'The user is no longer followed', type: FollowStateDto })
  unfollow(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<FollowStateDto> {
    return this.followsService.unfollow(user.userId, userId);
  }

  @Delete('followers/:userId')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Remove a follower, without telling them' })
  @ApiResponse({
    status: 200,
    description: 'The user no longer follows the authenticated user (`following` is false)',
    type: FollowStateDto,
  })
  removeFollower(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<FollowStateDto> {
    return this.followsService.removeFollower(user.userId, userId);
  }

  @Put('topics/:tag')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({
    summary: 'Follow a topic: public entries carrying the tag, ignoring case, join the Following feed',
  })
  @ApiResponse({ status: 200, description: 'The topic is followed', type: TopicFollowStateDto })
  @ApiResponse({ status: 400, description: 'The tag is empty or longer than 50 characters' })
  followTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param() { tag }: TopicParamDto,
  ): Promise<TopicFollowStateDto> {
    return this.topicFollowsService.follow(user.userId, tag);
  }

  @Delete('topics/:tag')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Stop following a topic' })
  @ApiResponse({ status: 200, description: 'The topic is no longer followed', type: TopicFollowStateDto })
  @ApiResponse({ status: 400, description: 'The tag is empty or longer than 50 characters' })
  unfollowTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param() { tag }: TopicParamDto,
  ): Promise<TopicFollowStateDto> {
    return this.topicFollowsService.unfollow(user.userId, tag);
  }
}
