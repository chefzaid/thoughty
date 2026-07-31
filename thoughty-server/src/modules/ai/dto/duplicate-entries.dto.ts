import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class FindDuplicateEntriesDto {
  @ApiPropertyOptional({
    description: 'Diary to scan; omit to scan across all diaries',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  diaryId?: number;
}

export class DuplicateEntryPreviewDto {
  @ApiProperty({ minimum: 1 })
  id!: number;

  @ApiProperty({ example: '2026-07-31' })
  date!: string;

  @ApiProperty({ minimum: 1 })
  index!: number;

  @ApiPropertyOptional({ minimum: 1, nullable: true })
  diaryId!: number | null;

  @ApiProperty({ description: 'Bounded entry preview' })
  content!: string;

  @ApiProperty({ type: [String] })
  tags!: string[];
}

export class DuplicateEntryGroupDto {
  @ApiProperty({ minimum: 70, maximum: 100 })
  confidence!: number;

  @ApiProperty({ description: 'Short explanation of the shared subject and conclusion' })
  reason!: string;

  @ApiProperty({ type: () => DuplicateEntryPreviewDto, isArray: true })
  entries!: DuplicateEntryPreviewDto[];
}

export class DuplicateEntryScanResponseDto {
  @ApiProperty({ minimum: 0 })
  analyzedEntries!: number;

  @ApiProperty({ minimum: 0 })
  totalEntries!: number;

  @ApiProperty({ description: 'Whether more entries existed than the bounded scan could analyze' })
  truncated!: boolean;

  @ApiProperty({ type: () => DuplicateEntryGroupDto, isArray: true })
  groups!: DuplicateEntryGroupDto[];
}
