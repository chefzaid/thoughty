import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Min } from 'class-validator';
import { StrictBoolean, StrictInt } from '@/common/validation';
import { ACCOUNT_EVENT_KINDS, type AccountEventKind } from '@/database/entities';

export class AccountActivityQueryDto {
  @ApiPropertyOptional({
    description: 'The `nextBefore` of the page before: this page holds the older events',
    example: 120,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  before?: number;
}

export class AccountEventDto {
  @ApiProperty({ example: 121 })
  id!: number;

  @ApiProperty({
    enum: ACCOUNT_EVENT_KINDS,
    description:
      'What happened: a sign-in, a refused sign-in (wrong password or code), a sign-out, other sessions signed out, ' +
      'a password changed or reset, two-factor authentication turned on or off, the PIN set, changed, reset or ' +
      'removed, the data downloaded, the journal exported, or a private share link made or revoked',
    example: 'sign_in',
  })
  kind!: AccountEventKind;

  @ApiProperty({ type: String, nullable: true, description: 'Browser name, without its version; null when unknown', example: 'Firefox' })
  browser!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'System name, without its version; null when unknown', example: 'Windows' })
  system!: string | null;

  @ApiProperty({ example: '2026-11-21T09:15:00.000Z' })
  createdAt!: Date;
}

export class AccountActivityResponseDto {
  @ApiProperty({ type: [AccountEventDto], description: 'The past year’s events, newest first, one page' })
  events!: AccountEventDto[];

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Pass as `before` for the older events; null on the last page',
    example: null,
  })
  nextBefore!: number | null;

  @ApiProperty({ description: 'Whether a sign-in from a new browser sends an email', example: true })
  newBrowserEmail!: boolean;
}

export class NewBrowserEmailDto {
  @ApiProperty({ description: 'Send an email when the account signs in from a browser it has not used before' })
  @StrictBoolean()
  enabled!: boolean;
}

export class NewBrowserEmailResponseDto {
  @ApiProperty({ example: false })
  newBrowserEmail!: boolean;
}
