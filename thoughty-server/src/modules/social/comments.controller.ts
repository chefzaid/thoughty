import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, RATE_LIMITS, throttleDefault } from '@/common';
import {
  CreateEntryCommentDto,
  EntryCommentDeletedDto,
  EntryCommentDto,
  EntryCommentsResponseDto,
} from './dto';
import { CommentsService } from './comments.service';

@ApiTags('Social')
@ApiBearerAuth()
@Controller('entries/:entryId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'List comments on a public entry' })
  @ApiResponse({
    status: 200,
    description: 'Recent comments, oldest first',
    type: EntryCommentsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'The entry is not visible in the public feed' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
  ): Promise<EntryCommentsResponseDto> {
    return this.commentsService.list(user.userId, entryId);
  }

  @Post()
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Comment on a public entry' })
  @ApiResponse({ status: 201, description: 'The new comment', type: EntryCommentDto })
  @ApiResponse({ status: 404, description: 'The entry is not visible in the public feed' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: CreateEntryCommentDto,
  ): Promise<EntryCommentDto> {
    return this.commentsService.create(user.userId, entryId, dto.content);
  }

  @Delete(':commentId')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Delete a comment you wrote or one on your entry' })
  @ApiResponse({
    status: 200,
    description: 'The comment was deleted',
    type: EntryCommentDeletedDto,
  })
  @ApiResponse({ status: 404, description: 'No deletable comment with this id on the entry' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
  ): Promise<EntryCommentDeletedDto> {
    return this.commentsService.remove(user.userId, entryId, commentId);
  }
}
