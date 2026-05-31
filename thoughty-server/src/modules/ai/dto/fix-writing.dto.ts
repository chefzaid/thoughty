import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
