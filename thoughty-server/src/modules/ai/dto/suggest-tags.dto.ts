import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const tagSuggestionStyles = ['specific', 'thematic'] as const;
export type TagSuggestionStyle = (typeof tagSuggestionStyles)[number];

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
  @IsInt()
  @Min(1)
  @Max(10)
  maxTags?: number;

  @ApiPropertyOptional({
    description: 'Whether to suggest concrete subject tags or broader thematic tags',
    enum: tagSuggestionStyles,
    default: 'specific',
  })
  @IsOptional()
  @IsString()
  @IsIn(tagSuggestionStyles)
  style?: TagSuggestionStyle;
}
