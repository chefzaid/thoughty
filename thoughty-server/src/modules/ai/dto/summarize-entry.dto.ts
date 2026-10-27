import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';

export class SummarizeEntryDto {
  @ApiProperty({ description: 'ID of the journal entry to summarize', minimum: 1 })
  @StrictInt()
  @Min(1)
  entryId!: number;

  @ApiPropertyOptional({
    description: 'Details or topics the summary should emphasize',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  includeDetails?: string;

  @ApiPropertyOptional({
    description: 'Details or topics the summary should omit',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excludeDetails?: string;
}

export class EntrySummaryResponseDto {
  @ApiProperty({ description: 'Generated summary of the journal entry' })
  summary!: string;
}
