import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { StrictBoolean, StrictInt } from '@/common/validation';

/** How many links a writer can have that have not expired yet, over all their entries and books. */
export const SHARE_LINK_LIMIT = 100;
/** The furthest a link can expire: a year, with a day to spare for a date picked in the writer's time zone. */
export const SHARE_LINK_MAX_DAYS = 366;
/** The soonest a link can expire. */
export const SHARE_LINK_MIN_MINUTES = 60;
export const SHARE_LINK_MAX_VIEWS = 1000;
export const SHARE_LINK_LABEL_MAX_LENGTH = 80;

export const SHARE_LINK_KINDS = ['entry', 'bookVersion'] as const;
export type ShareLinkKind = (typeof SHARE_LINK_KINDS)[number];

const trimToNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class CreateShareLinkDto {
  @ApiProperty({ enum: SHARE_LINK_KINDS, example: 'entry', description: 'What the link shares' })
  @IsIn(SHARE_LINK_KINDS)
  kind!: ShareLinkKind;

  @ApiProperty({ example: 42, minimum: 1, description: 'The entry or book version it shares; it must be the writer’s own' })
  @StrictInt()
  @Min(1)
  targetId!: number;

  @ApiProperty({
    example: '2026-11-04T09:30:00.000Z',
    format: 'date-time',
    description: `When the link stops working: at least ${SHARE_LINK_MIN_MINUTES} minutes and at most ${SHARE_LINK_MAX_DAYS} days ahead`,
  })
  @IsString()
  @IsISO8601({ strict: true })
  expiresAt!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'For Mum',
    maxLength: SHARE_LINK_LABEL_MAX_LENGTH,
    description: 'The writer’s note on who it is for; never shown to the reader',
  })
  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_dto, value) => value !== null)
  @IsString()
  @MaxLength(SHARE_LINK_LABEL_MAX_LENGTH)
  label?: string | null;

  @ApiPropertyOptional({ example: false, description: 'Show the entry’s mood and feelings to the reader (entries only)' })
  @IsOptional()
  @StrictBoolean()
  showMood?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Show the entry’s tags to the reader (entries only)' })
  @IsOptional()
  @StrictBoolean()
  showTags?: boolean;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 5,
    minimum: 1,
    maximum: SHARE_LINK_MAX_VIEWS,
    description: 'How many times the entry can be opened or the book downloaded; null or left out for no limit',
  })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @StrictInt()
  @Min(1)
  @Max(SHARE_LINK_MAX_VIEWS)
  maxViews?: number | null;
}

export class ShareLinkTargetQueryDto {
  @ApiProperty({ enum: SHARE_LINK_KINDS, example: 'entry' })
  @IsIn(SHARE_LINK_KINDS)
  kind!: ShareLinkKind;

  @ApiProperty({ example: 42, minimum: 1 })
  @StrictInt()
  @Min(1)
  targetId!: number;
}

/** A link as its writer sees it; never with its token, which only the creation answer carries. */
export class ShareLinkResponseDto {
  @ApiProperty({ example: 7 })
  id!: number;

  @ApiProperty({ enum: SHARE_LINK_KINDS, example: 'entry' })
  kind!: ShareLinkKind;

  @ApiProperty({ example: 42 })
  targetId!: number;

  @ApiProperty({ type: String, nullable: true, example: 'For Mum' })
  label!: string | null;

  @ApiProperty({ example: false })
  showMood!: boolean;

  @ApiProperty({ example: false })
  showTags!: boolean;

  @ApiProperty({ type: Number, nullable: true, example: 5, description: 'Null for no limit' })
  maxViews!: number | null;

  @ApiProperty({ example: 2, minimum: 0, description: 'Times the entry was opened or the book downloaded' })
  viewCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-10-29T18:02:00.000Z' })
  lastViewedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-04T09:30:00.000Z' })
  expiresAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-28T09:30:00.000Z' })
  createdAt!: Date;
}

export class CreatedShareLinkResponseDto extends ShareLinkResponseDto {
  @ApiProperty({
    example: 'q3Jm0bX9vN2kR7sT1uW4yZ6aC8eG0iK2mO4qS6uW8yA',
    description: 'The link’s secret, shown this once: the reader opens `/s/<token>`. Only its hash is kept.',
  })
  token!: string;
}

export class ShareLinkListResponseDto {
  @ApiProperty({ type: [ShareLinkResponseDto], description: 'The links of this entry or book version that have not expired, newest first' })
  links!: ShareLinkResponseDto[];

  @ApiProperty({ example: SHARE_LINK_LIMIT, description: 'How many unexpired links a writer can have' })
  limit!: number;

  @ApiProperty({ example: 3, minimum: 0, description: 'The writer’s unexpired links over everything they share' })
  activeCount!: number;
}
