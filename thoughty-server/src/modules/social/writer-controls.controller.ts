import { Controller, Delete, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, RATE_LIMITS, throttleDefault } from '@/common';
import { RequireFeature } from '@/common/feature-flags';
import { HiddenWritersResponseDto, WriterBlockStateDto, WriterMuteStateDto } from './dto';
import { WriterControlsService } from './writer-controls.service';

@ApiTags('Social')
@ApiBearerAuth()
@RequireFeature('publicSharing')
@Controller('writers')
export class WriterControlsController {
  constructor(private readonly writerControlsService: WriterControlsService) {}

  @Get('hidden')
  @ApiOperation({ summary: 'List the writers the authenticated user muted and blocked' })
  @ApiResponse({
    status: 200,
    description: 'Muted and blocked writers, by name',
    type: HiddenWritersResponseDto,
  })
  list(@CurrentUser() user: AuthenticatedUser): Promise<HiddenWritersResponseDto> {
    return this.writerControlsService.list(user.userId);
  }

  @Put(':userId/mute')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({
    summary: 'Mute a writer: their entries and comments leave your feed, and any follow stays',
  })
  @ApiResponse({ status: 200, description: 'The writer is muted', type: WriterMuteStateDto })
  @ApiResponse({ status: 400, description: 'Users cannot mute themselves' })
  @ApiResponse({
    status: 404,
    description: 'No writer with this id in the feed, its comments or your followers',
  })
  mute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<WriterMuteStateDto> {
    return this.writerControlsService.setMuted(user.userId, userId, true);
  }

  @Delete(':userId/mute')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Unmute a writer' })
  @ApiResponse({
    status: 200,
    description: 'The writer is no longer muted',
    type: WriterMuteStateDto,
  })
  unmute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<WriterMuteStateDto> {
    return this.writerControlsService.setMuted(user.userId, userId, false);
  }

  @Put(':userId/block')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({
    summary:
      'Block a writer: the follows end both ways, and each leaves the other’s feed, comments, followers, leaderboard and Saved list; they are not told',
  })
  @ApiResponse({ status: 200, description: 'The writer is blocked', type: WriterBlockStateDto })
  @ApiResponse({ status: 400, description: 'Users cannot block themselves' })
  @ApiResponse({
    status: 404,
    description: 'No writer with this id in the feed, its comments or your followers',
  })
  block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<WriterBlockStateDto> {
    return this.writerControlsService.setBlocked(user.userId, userId, true);
  }

  @Delete(':userId/block')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Unblock a writer; the follows that ended stay ended' })
  @ApiResponse({
    status: 200,
    description: 'The writer is no longer blocked',
    type: WriterBlockStateDto,
  })
  unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<WriterBlockStateDto> {
    return this.writerControlsService.setBlocked(user.userId, userId, false);
  }
}
