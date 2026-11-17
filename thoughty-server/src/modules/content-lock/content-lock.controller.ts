import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { RATE_LIMITS, throttleDefault } from '@/common';
import { currentContentAccess } from '@/common/content-lock';
import { SuccessResponseDto } from '@/common/dto';
import { TwoFactorChallengeResponseDto } from '@/modules/auth/dto';
import { FREE_PIN_ATTEMPTS, ContentPinService } from './content-pin.service';
import { ContentUnlockService } from './content-unlock.service';
import {
  ContentLockStatusDto,
  ContentPinChangedDto,
  ContentPinProofDto,
  ContentUnlockResponseDto,
  SetContentPinDto,
  UnlockContentDto,
} from './dto';

const PIN_CHANGE_RESPONSE = {
  status: 200,
  description:
    'Done, or (with the account password, when two-factor authentication is on or the account has no password) ' +
    'an emailed-code challenge to send back with its code',
  schema: {
    oneOf: [{ $ref: getSchemaPath(ContentPinChangedDto) }, { $ref: getSchemaPath(TwoFactorChallengeResponseDto) }],
  },
} as const;

@ApiTags('PIN lock')
@ApiBearerAuth()
@ApiExtraModels(ContentPinChangedDto, TwoFactorChallengeResponseDto)
@Controller('content-lock')
export class ContentLockController {
  constructor(
    private readonly pins: ContentPinService,
    private readonly unlocks: ContentUnlockService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Whether a PIN is set, anything is locked, and this request is unlocked' })
  @ApiResponse({ status: 200, description: 'The PIN lock’s state for the writer and this request', type: ContentLockStatusDto })
  async status(@CurrentUser() user: AuthenticatedUser): Promise<ContentLockStatusDto> {
    const [pin, hasLockedContent] = await Promise.all([
      this.pins.find(user.userId),
      this.pins.hasLockedContent(user.userId),
    ]);
    const access = currentContentAccess();
    const unlocked = access.unlockedUserId === user.userId;
    const blocked = pin?.blockedUntil && pin.blockedUntil > new Date() ? pin.blockedUntil : null;
    return {
      pinSet: Boolean(pin),
      hasLockedContent,
      unlocked,
      unlockExpiresAt: unlocked ? access.unlockExpiresAt : null,
      attemptsLeft: pin ? Math.max(0, FREE_PIN_ATTEMPTS - pin.failedAttempts) : FREE_PIN_ATTEMPTS,
      blockedUntil: blocked,
    };
  }

  @Put('pin')
  @Throttle(throttleDefault(RATE_LIMITS.contentPin))
  @ApiOperation({
    summary: 'Set or change the PIN',
    description:
      'Four digits. A first PIN needs nothing more; changing it needs the current PIN or, if it is forgotten, ' +
      'the account password (and the emailed code when two-factor authentication is on). Ends every unlock.',
  })
  @ApiResponse(PIN_CHANGE_RESPONSE)
  @ApiResponse({ status: 400, description: 'Not four digits, or no proof (`CONTENT_PIN_PROOF_REQUIRED`)' })
  @ApiResponse({ status: 401, description: 'Wrong password or code' })
  @ApiResponse({ status: 403, description: 'Wrong current PIN' })
  @ApiResponse({ status: 429, description: 'Too many wrong PINs' })
  async setPin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetContentPinDto,
  ): Promise<ContentPinChangedDto | TwoFactorChallengeResponseDto> {
    const { pin, ...proof } = dto;
    const challenge = await this.pins.set(user.userId, pin, proof);
    if (challenge) return challenge;
    await this.unlocks.endAll(user.userId);
    return { success: true };
  }

  @Post('pin/remove')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.contentPin))
  @ApiOperation({
    summary: 'Remove the PIN and every lock',
    description: 'Needs the same proof as changing it. Every diary and entry is unlocked for good.',
  })
  @ApiResponse(PIN_CHANGE_RESPONSE)
  @ApiResponse({ status: 400, description: 'No proof (`CONTENT_PIN_PROOF_REQUIRED`)' })
  @ApiResponse({ status: 401, description: 'Wrong password or code' })
  @ApiResponse({ status: 403, description: 'Wrong current PIN' })
  @ApiResponse({ status: 409, description: 'No PIN is set' })
  @ApiResponse({ status: 429, description: 'Too many wrong PINs' })
  async removePin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ContentPinProofDto,
  ): Promise<ContentPinChangedDto | TwoFactorChallengeResponseDto> {
    const challenge = await this.pins.remove(user.userId, dto);
    if (challenge) return challenge;
    await this.unlocks.endAll(user.userId);
    return { success: true };
  }

  @Post('unlock')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.contentPin))
  @ApiOperation({
    summary: 'Unlock locked diaries and entries with the PIN',
    description:
      'Five wrong PINs in a row block tries for a minute, and each further wrong one doubles the wait (up to a day). ' +
      'The unlock covers all of the account’s locked content until 15 minutes pass without a request carrying it.',
  })
  @ApiResponse({ status: 200, description: 'The unlock token, to send with each request', type: ContentUnlockResponseDto })
  @ApiResponse({ status: 403, description: 'Wrong PIN' })
  @ApiResponse({ status: 409, description: 'No PIN is set' })
  @ApiResponse({ status: 429, description: 'Too many wrong PINs' })
  async unlock(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UnlockContentDto,
  ): Promise<ContentUnlockResponseDto> {
    await this.pins.verify(user.userId, dto.pin);
    return this.unlocks.create(user.userId);
  }

  @Delete('unlock')
  @ApiOperation({ summary: 'Lock again: end the unlock this request carries' })
  @ApiResponse({ status: 200, description: 'Locked again', type: SuccessResponseDto })
  async lock(@CurrentUser() user: AuthenticatedUser): Promise<SuccessResponseDto> {
    await this.unlocks.end(user.userId, currentContentAccess().unlockTokenHash);
    return { success: true };
  }
}
