import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const MIN_REVIEW_YEAR = 1900;
export const MAX_REVIEW_YEAR = 2200;
export const YEAR_REVIEW_HIGHLIGHT_KINDS = ['first', 'favorite', 'longest', 'last'] as const;
export type YearReviewHighlightKind = (typeof YEAR_REVIEW_HIGHLIGHT_KINDS)[number];

export class YearReviewQueryDto {
  @ApiProperty({ example: 2025 })
  @Type(() => Number)
  @IsInt()
  @Min(MIN_REVIEW_YEAR)
  @Max(MAX_REVIEW_YEAR)
  year: number;

  @ApiPropertyOptional({ description: 'Review one diary instead of all of them' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  diaryId?: number;
}

export class YearMoodRequestDto {
  @ApiProperty({ example: 2025 })
  @IsInt()
  @Min(MIN_REVIEW_YEAR)
  @Max(MAX_REVIEW_YEAR)
  year: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  diaryId?: number;
}

export class YearReviewTotalsDto {
  @ApiProperty()
  entries: number;

  @ApiProperty()
  words: number;

  @ApiProperty({ description: 'Days with at least one entry' })
  writingDays: number;

  @ApiProperty({ description: 'Most consecutive days with an entry' })
  longestStreak: number;

  @ApiProperty()
  favorites: number;

  @ApiProperty({ description: 'Photos, recordings, and other files attached that year' })
  attachments: number;

  @ApiProperty()
  averageWords: number;
}

export class YearReviewComparisonDto {
  @ApiProperty()
  entries: number;

  @ApiProperty()
  words: number;

  @ApiProperty()
  writingDays: number;
}

export class YearReviewMonthDto {
  @ApiProperty({ minimum: 1, maximum: 12 })
  month: number;

  @ApiProperty()
  entries: number;

  @ApiProperty()
  words: number;
}

export class YearReviewTagDto {
  @ApiProperty()
  tag: string;

  @ApiProperty()
  count: number;
}

export class YearReviewHighlightDto {
  @ApiProperty({ enum: YEAR_REVIEW_HIGHLIGHT_KINDS })
  kind: YearReviewHighlightKind;

  @ApiProperty()
  entryId: number;

  @ApiProperty({ example: '2025-03-05' })
  date: string;

  @ApiProperty({ description: 'The start of the entry as plain text' })
  excerpt: string;

  @ApiProperty()
  words: number;

  @ApiProperty({ type: [String] })
  tags: string[];
}

export class YearReviewMoodMonthDto {
  @ApiProperty({ example: '2025-03' })
  month: string;

  @ApiProperty()
  mood: string;

  @ApiProperty({ minimum: -2, maximum: 2 })
  valence: number;
}

export class YearReviewMoodDto {
  @ApiProperty({ type: [YearReviewMoodMonthDto] })
  months: YearReviewMoodMonthDto[];

  @ApiProperty()
  summary: string;

  @ApiProperty()
  analyzedEntries: number;

  @ApiProperty()
  generatedAt: string;
}

export class YearReviewDto {
  @ApiProperty()
  year: number;

  @ApiProperty({ type: Number, nullable: true })
  diaryId: number | null;

  @ApiProperty({ type: [Number], description: 'Years with entries in this scope, newest first' })
  availableYears: number[];

  @ApiProperty({ type: YearReviewTotalsDto })
  totals: YearReviewTotalsDto;

  @ApiProperty({ type: YearReviewComparisonDto, nullable: true, description: 'The year before, when it has entries' })
  previousYear: YearReviewComparisonDto | null;

  @ApiProperty({ type: [YearReviewMonthDto], description: 'Twelve months, January first' })
  months: YearReviewMonthDto[];

  @ApiProperty({ type: [Number], description: 'Entries per weekday, Monday first' })
  weekdays: number[];

  @ApiProperty({ type: [YearReviewTagDto] })
  topTags: YearReviewTagDto[];

  @ApiProperty({ type: [String], description: 'Tags first used this year' })
  newTags: string[];

  @ApiProperty({ type: [YearReviewHighlightDto] })
  highlights: YearReviewHighlightDto[];

  @ApiProperty({ type: YearReviewMoodDto, nullable: true })
  mood: YearReviewMoodDto | null;

  @ApiProperty({ description: 'Whether the mood of the year can be read with AI' })
  aiAvailable: boolean;
}

export class YearMoodResponseDto {
  @ApiProperty({ type: YearReviewMoodDto })
  mood: YearReviewMoodDto;
}
