import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { AiService } from './ai.service';
import { SuggestTagsDto } from './dto/suggest-tags.dto';
import { FixWritingDto } from './dto/fix-writing.dto';
import { ChatDto, ChatHistoryResponseDto, ChatResponseDto } from './dto/chat.dto';
import { EntrySummaryResponseDto, SummarizeEntryDto } from './dto/summarize-entry.dto';
import { GenerateWritingPromptsDto, WritingPromptsResponseDto } from './dto/writing-prompts.dto';
import { AiDuplicateService } from './ai-duplicate.service';
import {
  DuplicateEntryScanResponseDto,
  FindDuplicateEntriesDto,
} from './dto/duplicate-entries.dto';
import { AiSemanticSearchService } from './ai-semantic-search.service';
import { SemanticSearchDto, SemanticSearchResponseDto } from './dto/semantic-search.dto';
import { AiCredentialsService } from './ai-credentials.service';
import {
  OpenRouterCredentialStatusDto,
  OpenRouterUsageDashboardDto,
  SaveOpenRouterCredentialDto,
} from './dto/openrouter-credentials.dto';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiDuplicateService: AiDuplicateService,
    private readonly aiSemanticSearchService: AiSemanticSearchService,
    private readonly aiCredentialsService: AiCredentialsService,
  ) {}

  @Get('models')
  @ApiOperation({ summary: 'List available OpenRouter models' })
  @ApiResponse({ status: 200, description: 'List of available models' })
  async listModels(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ id: string; name: string }[]> {
    return this.aiService.listModels(user.userId);
  }

  @Get('credentials')
  @ApiOperation({ summary: 'Get personal OpenRouter credential status' })
  @ApiResponse({
    status: 200,
    description: 'Personal OpenRouter credential status',
    type: OpenRouterCredentialStatusDto,
  })
  getCredentialStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OpenRouterCredentialStatusDto> {
    return this.aiCredentialsService.getStatus(user.userId);
  }

  @Put('credentials')
  @ApiOperation({ summary: 'Validate and store a personal OpenRouter API key' })
  @ApiResponse({
    status: 200,
    description: 'Personal OpenRouter credential validated and stored',
    type: OpenRouterCredentialStatusDto,
  })
  saveCredential(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveOpenRouterCredentialDto,
  ): Promise<OpenRouterCredentialStatusDto> {
    return this.aiCredentialsService.save(user.userId, dto.apiKey);
  }

  @Delete('credentials')
  @ApiOperation({ summary: 'Remove the personal OpenRouter API key' })
  @ApiResponse({
    status: 200,
    description: 'Personal OpenRouter credential removed',
    type: OpenRouterCredentialStatusDto,
  })
  removeCredential(@CurrentUser() user: AuthenticatedUser): Promise<OpenRouterCredentialStatusDto> {
    return this.aiCredentialsService.remove(user.userId);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get personal OpenRouter token and cost usage' })
  @ApiResponse({
    status: 200,
    description: 'Personal token and cost usage',
    type: OpenRouterUsageDashboardDto,
  })
  getUsage(@CurrentUser() user: AuthenticatedUser): Promise<OpenRouterUsageDashboardDto> {
    return this.aiCredentialsService.getUsage(user.userId);
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

  @Post('summarize')
  @ApiOperation({ summary: 'Summarize a journal entry with optional detail guidance' })
  @ApiResponse({
    status: 200,
    description: 'Entry summary returned successfully',
    type: EntrySummaryResponseDto,
  })
  async summarizeEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SummarizeEntryDto,
  ): Promise<EntrySummaryResponseDto> {
    return this.aiService.summarizeEntry(user.userId, dto);
  }

  @Post('writing-prompts')
  @ApiOperation({ summary: 'Generate writing prompts from recent journal history' })
  @ApiResponse({
    status: 200,
    description: 'Personalized writing prompts returned successfully',
    type: WritingPromptsResponseDto,
  })
  async generateWritingPrompts(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateWritingPromptsDto,
  ): Promise<WritingPromptsResponseDto> {
    return this.aiService.generateWritingPrompts(user.userId, dto);
  }

  @Post('duplicates')
  @ApiOperation({ summary: 'Find high-confidence semantic duplicate journal entries' })
  @ApiResponse({
    status: 200,
    description: 'Reviewable duplicate entry groups returned successfully',
    type: DuplicateEntryScanResponseDto,
  })
  async findDuplicates(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: FindDuplicateEntriesDto,
  ): Promise<DuplicateEntryScanResponseDto> {
    return this.aiDuplicateService.findDuplicates(user.userId, dto);
  }

  @Post('semantic-search')
  @ApiOperation({ summary: 'Search owned journal entries by semantic similarity' })
  @ApiResponse({
    status: 200,
    description: 'Ranked semantic entry matches returned successfully',
    type: SemanticSearchResponseDto,
  })
  async semanticSearch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SemanticSearchDto,
  ): Promise<SemanticSearchResponseDto> {
    return this.aiSemanticSearchService.search(user.userId, dto);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat about a journal entry with AI for analysis or discussion' })
  @ApiResponse({
    status: 200,
    description: 'AI reply returned successfully',
    type: ChatResponseDto,
  })
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
