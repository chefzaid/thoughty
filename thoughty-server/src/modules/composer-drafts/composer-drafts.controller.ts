import { Body, Controller, Delete, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { RATE_LIMITS, throttleDefault } from '@/common/rate-limit.constants';
import {
  ComposerDraftDiscardResponseDto,
  ComposerDraftEnvelopeDto,
  ComposerDraftResponseDto,
  DiscardComposerDraftQueryDto,
  SaveComposerDraftDto,
} from './dto';
import { ComposerDraftsService } from './composer-drafts.service';

@ApiTags('Composer draft')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('composer-draft')
export class ComposerDraftsController {
  constructor(private readonly draftsService: ComposerDraftsService) {}

  @Get()
  @ApiOperation({ summary: 'Get the new entry the writer is still writing, saved from any of their devices' })
  @ApiResponse({ status: 200, description: 'The draft, or null', type: ComposerDraftEnvelopeDto })
  async get(@CurrentUser() user: AuthenticatedUser): Promise<ComposerDraftEnvelopeDto> {
    return this.draftsService.get(user.userId);
  }

  @Put()
  @Throttle(throttleDefault(RATE_LIMITS.draftWrite))
  @ApiOperation({
    summary: 'Save the composer draft on top of the revision the device last saw',
    description: 'Autosaved as the writer types. Its text, title, tags, format, mood and feelings keep the entry limits.',
  })
  @ApiResponse({ status: 200, description: 'Draft saved at its new revision', type: ComposerDraftResponseDto })
  @ApiResponse({ status: 409, description: 'The draft was saved, published or discarded on another device (COMPOSER_DRAFT_CONFLICT)' })
  async save(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveComposerDraftDto,
  ): Promise<ComposerDraftResponseDto> {
    return this.draftsService.save(user.userId, dto);
  }

  @Delete()
  @Throttle(throttleDefault(RATE_LIMITS.draftWrite))
  @ApiOperation({ summary: 'Discard the composer draft, once it is published or the writer discards it' })
  @ApiResponse({ status: 200, description: 'Draft discarded, or there was none', type: ComposerDraftDiscardResponseDto })
  @ApiResponse({ status: 409, description: 'A newer draft was saved on another device and is kept (COMPOSER_DRAFT_CONFLICT)' })
  async discard(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: DiscardComposerDraftQueryDto,
  ): Promise<ComposerDraftDiscardResponseDto> {
    return this.draftsService.discard(user.userId, query.revision);
  }
}
