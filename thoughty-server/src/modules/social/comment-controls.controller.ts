import { Body, Controller, Delete, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, RATE_LIMITS, throttleDefault } from '@/common';
import { RequireFeature } from '@/common/feature-flags';
import { EntryCommentDto, EntryCommentPolicyDto, SetCommentPolicyDto } from './dto';
import { CommentControlsService } from './comment-controls.service';

const NOT_YOURS = 'The entry is not one of your public entries, or the comment is not on it';

@ApiTags('Social')
@ApiBearerAuth()
@RequireFeature('publicSharing')
@Controller('entries/:entryId')
export class CommentControlsController {
  constructor(private readonly commentControlsService: CommentControlsService) {}

  @Put('comment-policy')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Choose who may comment on your public entry' })
  @ApiResponse({
    status: 200,
    description: 'The entry’s comment policy',
    type: EntryCommentPolicyDto,
  })
  @ApiResponse({ status: 404, description: NOT_YOURS })
  setPolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: SetCommentPolicyDto,
  ): Promise<EntryCommentPolicyDto> {
    return this.commentControlsService.setPolicy(user.userId, entryId, dto.policy);
  }

  @Put('comments/:commentId/hidden')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Hide a comment on your entry from everyone but you and its writer' })
  @ApiResponse({ status: 200, description: 'The hidden comment', type: EntryCommentDto })
  @ApiResponse({ status: 404, description: NOT_YOURS })
  hide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<EntryCommentDto> {
    return this.commentControlsService.setHidden(user.userId, entryId, commentId, true);
  }

  @Delete('comments/:commentId/hidden')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Show a hidden comment on your entry to everyone again' })
  @ApiResponse({ status: 200, description: 'The comment, shown again', type: EntryCommentDto })
  @ApiResponse({ status: 404, description: NOT_YOURS })
  show(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<EntryCommentDto> {
    return this.commentControlsService.setHidden(user.userId, entryId, commentId, false);
  }

  @Put('comments/:commentId/pin')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Pin a comment on top of your entry’s comments, in place of any other' })
  @ApiResponse({ status: 200, description: 'The pinned comment', type: EntryCommentDto })
  @ApiResponse({ status: 400, description: 'The comment is hidden' })
  @ApiResponse({ status: 404, description: NOT_YOURS })
  pin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<EntryCommentDto> {
    return this.commentControlsService.setPinned(user.userId, entryId, commentId, true);
  }

  @Delete('comments/:commentId/pin')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Unpin a comment on your entry' })
  @ApiResponse({ status: 200, description: 'The comment, no longer pinned', type: EntryCommentDto })
  @ApiResponse({ status: 404, description: NOT_YOURS })
  unpin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<EntryCommentDto> {
    return this.commentControlsService.setPinned(user.userId, entryId, commentId, false);
  }
}
