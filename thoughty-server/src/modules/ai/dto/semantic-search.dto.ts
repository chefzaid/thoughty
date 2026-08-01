import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class SemanticSearchDto {
  @ApiProperty({ minLength: 2, maxLength: 200 })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  query!: string;

  @ApiPropertyOptional({ description: 'Diary to search; omit to search across all diaries', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  diaryId?: number;
}

export class SemanticSearchMatchDto {
  @ApiProperty({ minimum: 1 })
  entryId!: number;

  @ApiProperty({ minimum: -1, maximum: 1 })
  score!: number;
}

export class SemanticSearchResponseDto {
  @ApiProperty({ minimum: 0 })
  analyzedEntries!: number;

  @ApiProperty({ minimum: 0 })
  totalEntries!: number;

  @ApiProperty({ description: 'Whether older entries existed outside the bounded search window' })
  truncated!: boolean;

  @ApiProperty({ type: () => SemanticSearchMatchDto, isArray: true })
  matches!: SemanticSearchMatchDto[];
}
