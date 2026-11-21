import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { AccessTokenScopes, CurrentAccessToken } from './access-token.guard';
import type { AuthenticatedAccessToken } from './access-tokens.service';
import { PublicApiService } from './public-api.service';
import {
  PublicCreateEntryDto,
  PublicCreatedEntryResponseDto,
  PublicDiaryListResponseDto,
  PublicEntriesQueryDto,
  PublicEntryListResponseDto,
} from './dto';

/**
 * The public API: a few journal routes for scripts, iOS Shortcuts or Zapier, opened by a personal access
 * token (`Authorization: Bearer thy_…`) instead of a session.
 */
@ApiTags('Public API')
@Controller('v1')
export class PublicApiController {
  constructor(private readonly publicApi: PublicApiService) {}

  @Get('diaries')
  @AccessTokenScopes('entries:read', 'entries:write')
  @ApiOperation({ summary: 'The writer’s diaries, to pick one to write in or list' })
  @ApiResponse({ status: 200, description: 'The diaries', type: PublicDiaryListResponseDto })
  async listDiaries(@CurrentUser() user: AuthenticatedUser): Promise<PublicDiaryListResponseDto> {
    return this.publicApi.listDiaries(user.userId);
  }

  @Get('entries')
  @AccessTokenScopes('entries:read')
  @ApiOperation({
    summary: 'The writer’s entries, newest first, a page at a time',
    description:
      'Optionally in one diary or matching a search (the journal’s search syntax). Entries in the recycle bin ' +
      'are left out; a locked or sealed entry comes without its text, tags, mood and feelings.',
  })
  @ApiResponse({ status: 200, description: 'One page of entries', type: PublicEntryListResponseDto })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED: an invalid limit, diary, search or cursor' })
  async listEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PublicEntriesQueryDto,
  ): Promise<PublicEntryListResponseDto> {
    return this.publicApi.listEntries(user.userId, query);
  }

  @Post('entries')
  @AccessTokenScopes('entries:write')
  @ApiOperation({
    summary: 'Write a new private entry',
    description:
      'Without a `date`, the entry is for today in the time zone of the browser that made the token. Without a ' +
      '`diaryId`, it goes to the default diary. Tags, mentions and automatic tagging work as in the composer.',
  })
  @ApiResponse({ status: 201, description: 'The entry written', type: PublicCreatedEntryResponseDto })
  @ApiResponse({ status: 400, description: 'VALIDATION_FAILED: an invalid text, date, tag, mood or diary' })
  @ApiResponse({ status: 404, description: 'DIARY_NOT_FOUND: the diary is not the writer’s' })
  async createEntry(
    @CurrentAccessToken() token: AuthenticatedAccessToken,
    @Body() dto: PublicCreateEntryDto,
  ): Promise<PublicCreatedEntryResponseDto> {
    return this.publicApi.createEntry(token, dto);
  }
}
