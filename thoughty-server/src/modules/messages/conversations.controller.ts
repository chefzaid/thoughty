import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, RATE_LIMITS, throttleDefault } from '@/common';
import { RequireFeature } from '@/common/feature-flags';
import { ConversationsService } from './conversations.service';
import {
  ConversationListDto,
  ConversationMessagesQueryDto,
  ConversationSummaryDto,
  ConversationThreadDto,
  MessageDto,
  SendMessageDto,
  UnreadMessagesDto,
} from './dto';

@ApiTags('Messages')
@ApiBearerAuth()
@RequireFeature('publicSharing')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @Throttle(throttleDefault(RATE_LIMITS.messagesRead))
  @ApiOperation({
    summary: 'List the conversations with at least one message, the most recent first',
  })
  @ApiResponse({
    status: 200,
    description: 'The conversations, each with its newest message',
    type: ConversationListDto,
  })
  list(@CurrentUser() user: AuthenticatedUser): Promise<ConversationListDto> {
    return this.conversationsService.list(user.userId);
  }

  // Declared before `:conversationId`, which would otherwise take `unread` as an id
  @Get('unread')
  @Throttle(throttleDefault(RATE_LIMITS.messagesRead))
  @ApiOperation({ summary: 'Count the unread messages across every conversation' })
  @ApiResponse({
    status: 200,
    description: 'How many messages are unread',
    type: UnreadMessagesDto,
  })
  countUnread(@CurrentUser() user: AuthenticatedUser): Promise<UnreadMessagesDto> {
    return this.conversationsService.countUnread(user.userId);
  }

  @Put('with/:userId')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({
    summary:
      'Open the conversation with a writer you follow and who follows you, made the first time',
  })
  @ApiResponse({ status: 200, description: 'The conversation', type: ConversationSummaryDto })
  @ApiResponse({ status: 400, description: 'Users cannot write to themselves' })
  @ApiResponse({
    status: 404,
    description:
      'No writer with this id who follows you and whom you follow, without a block either way',
  })
  open(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ConversationSummaryDto> {
    return this.conversationsService.open(user.userId, userId);
  }

  @Get(':conversationId')
  @Throttle(throttleDefault(RATE_LIMITS.messagesRead))
  @ApiOperation({ summary: 'Read a conversation: its newest messages, or those before `before`' })
  @ApiResponse({
    status: 200,
    description: 'The conversation and a page of its messages',
    type: ConversationThreadDto,
  })
  @ApiResponse({ status: 400, description: '`before` is not a positive whole number' })
  @ApiResponse({ status: 404, description: 'No conversation of yours with this id' })
  thread(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Query() { before }: ConversationMessagesQueryDto,
  ): Promise<ConversationThreadDto> {
    return this.conversationsService.thread(user.userId, conversationId, before);
  }

  @Post(':conversationId/messages')
  @Throttle(throttleDefault(RATE_LIMITS.messageWrite))
  @ApiOperation({
    summary:
      'Send a message, while you and the other writer follow each other, optionally sharing one of your public entries',
  })
  @ApiResponse({ status: 201, description: 'The message as sent', type: MessageDto })
  @ApiResponse({
    status: 400,
    description:
      'The message is empty or longer than 2000 characters, or the entry to share is not public (`MESSAGE_ENTRY_NOT_PUBLIC`)',
  })
  @ApiResponse({ status: 403, description: 'You and the other writer no longer follow each other' })
  @ApiResponse({
    status: 404,
    description: 'No conversation of yours with this id, or no entry of yours with `entryId`',
  })
  send(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Body() { body, entryId }: SendMessageDto,
  ): Promise<MessageDto> {
    return this.conversationsService.send(user.userId, conversationId, body, entryId);
  }

  @Put(':conversationId/read')
  @Throttle(throttleDefault(RATE_LIMITS.messagesRead))
  @ApiOperation({ summary: 'Mark a conversation read up to its newest message' })
  @ApiResponse({
    status: 200,
    description: 'How many messages are still unread elsewhere',
    type: UnreadMessagesDto,
  })
  @ApiResponse({ status: 404, description: 'No conversation of yours with this id' })
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ): Promise<UnreadMessagesDto> {
    return this.conversationsService.markRead(user.userId, conversationId);
  }

  @Delete(':conversationId/messages/:messageId')
  @Throttle(throttleDefault(RATE_LIMITS.messageWrite))
  @ApiOperation({
    summary:
      'Delete a message for yourself, one you wrote or received; the other writer still has it',
  })
  @ApiResponse({
    status: 200,
    description: 'How many messages are still unread',
    type: UnreadMessagesDto,
  })
  @ApiResponse({
    status: 404,
    description:
      'No conversation of yours with this id, or no message with this id in it that you still have (`MESSAGE_NOT_FOUND`)',
  })
  deleteMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
    @Param('messageId', ParseIntPipe) messageId: number,
  ): Promise<UnreadMessagesDto> {
    return this.conversationsService.deleteMessage(user.userId, conversationId, messageId);
  }

  @Delete(':conversationId')
  @Throttle(throttleDefault(RATE_LIMITS.messageWrite))
  @ApiOperation({
    summary:
      'Delete a conversation for yourself: its messages so far leave your list, and it comes back with the next one',
  })
  @ApiResponse({
    status: 200,
    description: 'How many messages are still unread',
    type: UnreadMessagesDto,
  })
  @ApiResponse({ status: 404, description: 'No conversation of yours with this id' })
  deleteConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseIntPipe) conversationId: number,
  ): Promise<UnreadMessagesDto> {
    return this.conversationsService.deleteConversation(user.userId, conversationId);
  }
}
