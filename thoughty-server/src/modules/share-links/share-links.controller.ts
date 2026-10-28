import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { SuccessResponseDto } from '@/common/dto';
import { RATE_LIMITS, throttleDefault } from '@/common/rate-limit.constants';
import {
  CreateShareLinkDto,
  CreatedShareLinkResponseDto,
  ShareLinkListResponseDto,
  ShareLinkTargetQueryDto,
} from './dto';
import { ShareLinksService } from './share-links.service';

@ApiTags('Share links')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('share-links')
export class ShareLinksController {
  constructor(private readonly shareLinksService: ShareLinksService) {}

  @Get()
  @ApiOperation({ summary: 'List the unexpired private share links of one of the writer’s entries or book versions' })
  @ApiResponse({ status: 200, description: 'The links, newest first, without their tokens', type: ShareLinkListResponseDto })
  @ApiResponse({ status: 404, description: 'Entry or book version not found' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ShareLinkTargetQueryDto,
  ): Promise<ShareLinkListResponseDto> {
    return this.shareLinksService.list(user.userId, query.kind, query.targetId);
  }

  @Post()
  @Throttle(throttleDefault(RATE_LIMITS.shareLinkWrite))
  @ApiOperation({
    summary: 'Make a private share link for an entry or a book version',
    description: 'The answer carries the link’s token this once; only its hash is kept. A sealed time capsule cannot be shared.',
  })
  @ApiResponse({ status: 201, description: 'Link made', type: CreatedShareLinkResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid expiry or options, or the share link limit is reached' })
  @ApiResponse({ status: 404, description: 'Entry or book version not found' })
  @ApiResponse({ status: 409, description: 'The entry is sealed as a time capsule' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateShareLinkDto,
  ): Promise<CreatedShareLinkResponseDto> {
    return this.shareLinksService.create(user.userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a private share link: it stops working at once' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Link revoked', type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'Share link not found' })
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SuccessResponseDto> {
    return this.shareLinksService.revoke(user.userId, id);
  }
}
