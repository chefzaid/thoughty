import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class GenerateWritingPromptsDto {
  @ApiPropertyOptional({
    description: 'Diary whose recent entries should inform the prompts',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  diaryId?: number;
}

export class WritingPromptsResponseDto {
  @ApiProperty({
    description: 'Personalized journal writing prompts',
    type: [String],
  })
  prompts!: string[];
}
