import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SummarizeEntryDto {
  @ApiProperty({ description: 'ID of the journal entry to summarize', minimum: 1 })
  @IsInt()
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
