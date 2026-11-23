import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';

export const fixWritingModes = ['grammar', 'polish', 'rewrite'] as const;

export type FixWritingMode = (typeof fixWritingModes)[number];

export class FixWritingDto {
  @ApiProperty({ description: 'Entry content to fix for grammar, spelling, and style' })
  @IsString()
  @MaxLength(10000)
  content!: string;

  @ApiPropertyOptional({
    description: 'Rephrase mode to apply',
    enum: fixWritingModes,
    default: 'grammar',
  })
  @IsOptional()
  @IsString()
  @IsIn(fixWritingModes)
  mode?: FixWritingMode;

  @ApiPropertyOptional({
    description: 'Diary the text is written in; a diary with AI off refuses the request (`403 DIARY_AI_OFF`)',
    minimum: 1,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  diaryId?: number;
}

export class FixWritingResponseDto {
  @ApiProperty({ description: 'The content rewritten in the requested mode' })
  content!: string;
}
