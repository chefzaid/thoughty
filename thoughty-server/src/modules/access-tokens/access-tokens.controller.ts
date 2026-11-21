import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { SuccessResponseDto } from '@/common/dto';
import { RATE_LIMITS, throttleDefault } from '@/common/rate-limit.constants';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { AccountActivityService } from '@/modules/auth/account-activity/account-activity.service';
import { AccessTokensService } from './access-tokens.service';
import { PersonalAccessTokenListResponseDto, CreatePersonalAccessTokenDto, CreatedPersonalAccessTokenResponseDto } from './dto';

/** The writer's personal access tokens, managed from a session in Profile › Access tokens. */
@ApiTags('Access tokens')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('access-tokens')
export class AccessTokensController {
  constructor(
    private readonly accessTokens: AccessTokensService,
    private readonly activity: AccountActivityService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the writer’s unexpired personal access tokens, newest first' })
  @ApiResponse({ status: 200, description: 'The tokens, without the tokens themselves', type: PersonalAccessTokenListResponseDto })
  async list(@CurrentUser() user: AuthenticatedUser): Promise<PersonalAccessTokenListResponseDto> {
    return this.accessTokens.list(user.userId);
  }

  @Post()
  @Throttle(throttleDefault(RATE_LIMITS.shareLinkWrite))
  @ApiOperation({
    summary: 'Make a personal access token for the public API',
    description: 'The answer carries the token itself, this once; only its hash is kept.',
  })
  @ApiResponse({ status: 201, description: 'The token, shown once', type: CreatedPersonalAccessTokenResponseDto })
  @ApiResponse({ status: 400, description: 'ACCESS_TOKEN_LIMIT_REACHED, or an invalid name, scope, expiry or time zone' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePersonalAccessTokenDto,
  ): Promise<CreatedPersonalAccessTokenResponseDto> {
    const created = await this.accessTokens.create(user.userId, dto);
    await this.activity.record(user.userId, 'access_token_created');
    return created;
  }

  @Delete(':id')
  @Throttle(throttleDefault(RATE_LIMITS.shareLinkWrite))
  @ApiOperation({ summary: 'Revoke a personal access token, which deletes it' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Revoked', type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'ACCESS_TOKEN_NOT_FOUND' })
  async revoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SuccessResponseDto> {
    const revoked = await this.accessTokens.revoke(user.userId, id);
    await this.activity.record(user.userId, 'access_token_revoked');
    return revoked;
  }
}
