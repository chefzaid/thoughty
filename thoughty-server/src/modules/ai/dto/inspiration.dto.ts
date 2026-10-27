import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';

export class GenerateInspirationDto {
  @ApiPropertyOptional({
    description: 'Diary whose tags should inform the question',
    minimum: 1,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  diaryId?: number;
}

export class InspirationResponseDto {
  @ApiProperty({
    description: 'A reflective journal question based on the user tags',
  })
  question!: string;
}
