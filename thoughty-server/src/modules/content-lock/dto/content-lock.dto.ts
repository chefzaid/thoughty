import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { StrictBoolean } from '@/common/validation';

/** Exactly four digits. */
export const CONTENT_PIN_PATTERN = /^\d{4}$/;

const PIN_MESSAGE = 'The PIN must be exactly 4 digits';

/**
 * What proves the writer may change, remove or reset their PIN: the current PIN, or the account
 * password (an account without a password gives none) followed, when two-factor authentication is on or
 * the account has no password, by the emailed code of the challenge the first try answered with.
 */
export class ContentPinProofDto {
  @ApiPropertyOptional({ example: '1234', pattern: CONTENT_PIN_PATTERN.source, description: 'The current PIN' })
  @IsOptional()
  @IsString()
  @Matches(CONTENT_PIN_PATTERN, { message: PIN_MESSAGE })
  currentPin?: string;

  @ApiPropertyOptional({ description: 'The account password, for a forgotten PIN' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password?: string;

  @ApiPropertyOptional({ description: 'The challenge an earlier try answered with, when an emailed code is needed' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  challengeToken?: string;

  @ApiPropertyOptional({ example: '123456', description: 'The emailed code of that challenge' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must contain exactly 6 digits' })
  code?: string;
}

export class SetContentPinDto extends ContentPinProofDto {
  @ApiProperty({ example: '2468', pattern: CONTENT_PIN_PATTERN.source, description: 'The new PIN' })
  @IsString()
  @Matches(CONTENT_PIN_PATTERN, { message: PIN_MESSAGE })
  pin: string;
}

export class UnlockContentDto {
  @ApiProperty({ example: '2468', pattern: CONTENT_PIN_PATTERN.source })
  @IsString()
  @Matches(CONTENT_PIN_PATTERN, { message: PIN_MESSAGE })
  pin: string;
}

export class SetLockDto {
  @ApiProperty({ description: 'Lock (true) or unlock (false); unlocking needs an unlocked request' })
  @StrictBoolean()
  locked: boolean;
}

export class ContentLockStatusDto {
  @ApiProperty({ description: 'Whether the writer has set a PIN' })
  pinSet: boolean;

  @ApiProperty({ description: 'Whether any of their diaries or entries is locked' })
  hasLockedContent: boolean;

  @ApiProperty({ description: 'Whether this request carries a valid unlock' })
  unlocked: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When that unlock ends without further activity' })
  unlockExpiresAt: Date | null;

  @ApiProperty({ description: 'Wrong PINs that may still be tried before tries are blocked for a while', example: 5 })
  attemptsLeft: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Until when no PIN is accepted after too many wrong ones' })
  blockedUntil: Date | null;
}

export class ContentUnlockResponseDto {
  @ApiProperty({
    description:
      'Send it as the `X-Content-Unlock` header to read locked diaries and entries. Keep it for this tab only.',
  })
  token: string;

  @ApiProperty({ type: String, format: 'date-time', description: 'When it ends without further activity (each request extends it)' })
  expiresAt: Date;
}

export class ContentPinChangedDto {
  @ApiProperty({ example: true })
  success: true;
}
