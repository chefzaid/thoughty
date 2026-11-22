import { Body, Controller, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { RequireFeature } from '@/common/feature-flags';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { EntryChatDto, EntryChatQueryDto, EntryChatResponseDto } from './dto';
import { EntryChatService } from './entry-chat.service';

@ApiTags('Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('entries')
export class EntryChatController {
  constructor(private readonly entryChatService: EntryChatService) {}

  @Post('chat')
  @RequireFeature('ai')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Discuss the entries of the journal filters with AI',
    description:
      'Answers the conversation\'s last message about the entries the journal list shows with the same filters ' +
      '(its day, or a date range, among them): the newest that match, at most 50 and as many as fit the model, ' +
      'read oldest first and numbered from 1. The reply cites entries by their number in square brackets; the ' +
      'answer lists the entries read and the numbers cited. Nothing of the conversation is kept. Sealed time ' +
      'capsules, locked entries (unless the request is unlocked) and entries in the recycle bin are left out.',
  })
  @ApiResponse({ status: 200, description: 'The reply and the entries it read', type: EntryChatResponseDto })
  @ApiResponse({ status: 400, description: 'A filter or a message is invalid, or AI is not available (`AI_KEY_NOT_CONFIGURED`)' })
  @ApiResponse({ status: 404, description: 'No entry matches (`ENTRY_CHAT_NO_MATCH`)' })
  @ApiResponse({ status: 502, description: 'The AI provider failed (`AI_PROVIDER_FAILED`)' })
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EntryChatQueryDto,
    @Body() dto: EntryChatDto,
  ): Promise<EntryChatResponseDto> {
    return this.entryChatService.chat(user.userId, query, dto);
  }
}
