import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';

export class SuggestTagsDto {
  @ApiProperty({ description: 'Entry content to analyze for tag suggestions' })
  @IsString()
  @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({
    description: 'Existing tags already attached to the draft',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  existingTags?: string[];

  @ApiPropertyOptional({ description: 'Maximum number of tags to return', default: 5 })
  @IsOptional()
  @StrictInt()
  @Min(1)
  @Max(10)
  maxTags?: number;

  @ApiPropertyOptional({
    description: 'Diary the text is written in; a diary with AI off refuses the request (`403 DIARY_AI_OFF`)',
    minimum: 1,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  diaryId?: number;
}

export class SuggestTagsResponseDto {
  @ApiProperty({ type: [String], description: 'Suggested tags, lowercased, without the ones already attached' })
  tags!: string[];
}
