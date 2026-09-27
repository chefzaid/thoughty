import { Controller, Delete, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, RATE_LIMITS, throttleDefault } from '@/common';
import { LikeStateDto } from './dto';
import { LikesService } from './likes.service';

@ApiTags('Social')
@ApiBearerAuth()
@Controller('entries/:entryId')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Put('like')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Like a public entry written by someone else' })
  @ApiResponse({
    status: 200,
    description: 'Like state and count of the entry',
    type: LikeStateDto,
  })
  @ApiResponse({ status: 400, description: 'Users cannot like their own entries' })
  @ApiResponse({ status: 404, description: 'The entry is not visible in the public feed' })
  likeEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
  ): Promise<LikeStateDto> {
    return this.likesService.setEntryLike(user.userId, entryId, true);
  }

  @Delete('like')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Remove your like from a public entry' })
  @ApiResponse({
    status: 200,
    description: 'Like state and count of the entry',
    type: LikeStateDto,
  })
  @ApiResponse({ status: 404, description: 'The entry is not visible in the public feed' })
  unlikeEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
  ): Promise<LikeStateDto> {
    return this.likesService.setEntryLike(user.userId, entryId, false);
  }

  @Put('comments/:commentId/like')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Like a comment written by someone else' })
  @ApiResponse({
    status: 200,
    description: 'Like state and count of the comment',
    type: LikeStateDto,
  })
  @ApiResponse({ status: 400, description: 'Users cannot like their own comments' })
  @ApiResponse({ status: 404, description: 'No visible comment with this id on the entry' })
  likeComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<LikeStateDto> {
    return this.likesService.setCommentLike(user.userId, entryId, commentId, true);
  }

  @Delete('comments/:commentId/like')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Remove your like from a comment' })
  @ApiResponse({
    status: 200,
    description: 'Like state and count of the comment',
    type: LikeStateDto,
  })
  @ApiResponse({ status: 404, description: 'No visible comment with this id on the entry' })
  unlikeComment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<LikeStateDto> {
    return this.likesService.setCommentLike(user.userId, entryId, commentId, false);
  }
}
