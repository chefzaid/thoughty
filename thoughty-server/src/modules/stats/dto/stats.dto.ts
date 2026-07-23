import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Matches, Min } from 'class-validator';

export class ToneMoodAnalysisDto {
  @ApiProperty({ example: 'reflective' })
  dominantMood!: string;

  @ApiProperty({ example: 'candid' })
  dominantTone!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { reflective: 14, calm: 9, anxious: 4 },
  })
  moodBreakdown!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { candid: 12, analytical: 8, intimate: 7 },
  })
  toneBreakdown!: Record<string, number>;

  @ApiProperty({ example: 27 })
  analyzedEntries!: number;

  @ApiProperty({
    example:
      'Recent thoughts are mostly reflective and calm, with a candid and personal writing tone.',
  })
  summary!: string;
}

export class SubjectAnalysisDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { work: 12, relationships: 8, health: 5 },
  })
  subjectBreakdown!: Record<string, number>;

  @ApiProperty({ example: 27 })
  analyzedEntries!: number;

  @ApiProperty({
    example: 'Recent entries focus mostly on work, relationships, and personal wellbeing.',
  })
  summary!: string;
}

export class PersonalityAnalysisRequestDto {
  @ApiPropertyOptional({ example: 3, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  diaryId?: number;

  @ApiPropertyOptional({ example: '2025-01-01', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  fromDate?: string;

  @ApiPropertyOptional({ example: '2025-12-31', format: 'date' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  toDate?: string;
}

export class PersonalityTraitDto {
  @ApiProperty({ example: 'Reflective decision-making' })
  label!: string;

  @ApiProperty({ example: 78, minimum: 0, maximum: 100 })
  score!: number;

  @ApiProperty({
    example: 'Planning and reflection vocabulary appears consistently across the selected entries.',
  })
  evidence!: string;
}

export class PersonalityAnalysisDto {
  @ApiProperty({ type: [PersonalityTraitDto] })
  traits!: PersonalityTraitDto[];

  @ApiProperty({
    example: 'The selected writing suggests a reflective, structured approach to daily decisions.',
  })
  summary!: string;

  @ApiProperty({ example: 184 })
  analyzedEntries!: number;

  @ApiProperty({ example: 28412 })
  analyzedWords!: number;

  @ApiProperty({ example: '2024-01-03', format: 'date' })
  fromDate!: string;

  @ApiProperty({ example: '2025-12-19', format: 'date' })
  toDate!: string;
}

export class PersonalityAnalysisResponseDto {
  @ApiProperty({ type: PersonalityAnalysisDto, nullable: true })
  analysis!: PersonalityAnalysisDto | null;
}

export class StatsResponseDto {
  @ApiProperty({ example: 120 })
  totalThoughts!: number;

  @ApiProperty({ example: 184 })
  averageWordsPerEntry!: number;

  @ApiProperty({ example: 1 })
  averageReadingTimeMinutes!: number;

  @ApiProperty({ example: 18 })
  uniqueTagsCount!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { '2024': 48, '2025': 72 },
  })
  thoughtsPerYear!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { '2025-01': 12, '2025-02': 18 },
  })
  thoughtsPerMonth!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { '2025-02-10': 1, '2025-02-11': 3 },
  })
  thoughtsPerDay!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { work: 22, health: 9 },
  })
  thoughtsPerTag!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
    example: { '2025': { work: 10, health: 4 } },
  })
  tagsPerYear!: Record<string, Record<string, number>>;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
    example: { '2025-02': { work: 6, health: 2 } },
  })
  tagsPerMonth!: Record<string, Record<string, number>>;

  @ApiProperty({
    type: ToneMoodAnalysisDto,
    nullable: true,
    required: false,
  })
  toneMoodAnalysis!: ToneMoodAnalysisDto | null;

  @ApiProperty({
    type: SubjectAnalysisDto,
    nullable: true,
    required: false,
  })
  subjectAnalysis!: SubjectAnalysisDto | null;
}
