import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { AiService } from './ai.service';
import { SuggestTagsDto } from './dto/suggest-tags.dto';
import { FixWritingDto } from './dto/fix-writing.dto';
import { ChatDto, ChatHistoryResponseDto, ChatResponseDto } from './dto/chat.dto';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('models')
  @ApiOperation({ summary: 'List available OpenRouter models' })
  @ApiResponse({ status: 200, description: 'List of available models' })
  async listModels(): Promise<{ id: string; name: string }[]> {
    return this.aiService.listModels();
  }

  @Post('suggest-tags')
  @ApiOperation({ summary: 'Suggest tags for journal content using OpenRouter' })
  @ApiResponse({ status: 200, description: 'Suggested tags returned successfully' })
  async suggestTags(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SuggestTagsDto,
  ): Promise<{ tags: string[] }> {
    return this.aiService.suggestTags(user.userId, dto);
  }

  @Post('fix-writing')
  @ApiOperation({ summary: 'Fix grammar, spelling, and style in journal content using OpenRouter' })
  @ApiResponse({ status: 200, description: 'Corrected content returned successfully' })
  async fixWriting(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FixWritingDto,
  ): Promise<{ content: string }> {
    return this.aiService.fixWriting(user.userId, dto);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat about a journal entry with AI for analysis or discussion' })
  @ApiResponse({ status: 200, description: 'AI reply returned successfully', type: ChatResponseDto })
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatDto,
  ): Promise<ChatResponseDto> {
    return this.aiService.chat(user.userId, dto);
  }

  @Get('history/:entryId')
  @ApiOperation({ summary: 'Get persisted AI chat history for an entry' })
  @ApiParam({ name: 'entryId', type: Number })
  @ApiResponse({ status: 200, description: 'Stored AI chat history', type: ChatHistoryResponseDto })
  async getHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
  ): Promise<ChatHistoryResponseDto> {
    return this.aiService.getChatHistory(user.userId, entryId);
  }
}