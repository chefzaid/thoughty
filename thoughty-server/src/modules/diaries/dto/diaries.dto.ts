import { IsString, IsOptional, IsEnum, MaxLength, IsArray, IsInt, IsIn, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DiaryGoalType } from '@/database/entities';
import { DIARY_GOAL_TYPES, IsDiaryGoalTarget } from './diary-goal.dto';

const DIARY_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** The optional writing goal, sent when creating or updating a diary. */
class DiaryGoalFieldsDto {
  @ApiPropertyOptional({
    enum: DIARY_GOAL_TYPES,
    nullable: true,
    example: 'entries_per_week',
    description: 'Writing goal type; null removes the goal, left out keeps it on update',
  })
  @IsOptional()
  @IsIn(DIARY_GOAL_TYPES)
  goalType?: DiaryGoalType | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 3,
    description: 'Entries a week (1-50) or words a day (10-10000); required with a goal type',
  })
  @IsDiaryGoalTarget()
  goalTarget?: number | null;
}

export class CreateDiaryDto extends DiaryGoalFieldsDto {
  @ApiProperty({ description: 'Diary name' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Diary icon', default: '📓' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'], default: 'private' })
  @IsOptional()
  @IsEnum(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ description: 'Diary accent color in hex format', example: '#2A9D8F' })
  @IsOptional()
  @IsString()
  @Matches(DIARY_COLOR_PATTERN)
  color?: string;
}

export class UpdateDiaryDto extends DiaryGoalFieldsDto {
  @ApiProperty({ description: 'Diary name' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Diary icon' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icon?: string;

  @ApiPropertyOptional({ enum: ['public', 'private'] })
  @IsOptional()
  @IsEnum(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ description: 'Diary accent color in hex format', example: '#2A9D8F' })
  @IsOptional()
  @IsString()
  @Matches(DIARY_COLOR_PATTERN)
  color?: string;
}

export class DiaryResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  name: string;

  @ApiProperty()
  icon: string;

  @ApiPropertyOptional()
  color?: string | null;

  @ApiProperty()
  visibility: 'public' | 'private';

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty()
  position: number;

  @ApiProperty({ enum: DIARY_GOAL_TYPES, nullable: true, example: 'entries_per_week' })
  goalType: DiaryGoalType | null;

  @ApiProperty({ type: Number, nullable: true, example: 3 })
  goalTarget: number | null;

  @ApiProperty()
  createdAt: Date;
}

export class ReorderDiariesDto {
  @ApiProperty({ description: 'Ordered array of diary IDs', type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  orderedIds: number[];
}
