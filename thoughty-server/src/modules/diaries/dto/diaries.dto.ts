import { IsString, IsOptional, IsEnum, MaxLength, IsArray, IsIn, Matches, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { DIARY_AI_MODES, type DiaryAiMode, type DiaryGoalType } from '@/database/entities';
import { DIARY_GOAL_TYPES, IsDiaryGoalTarget } from './diary-goal.dto';
import { StrictInt, toStrictInt } from '@/common/validation';

const DIARY_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** A template ID as the web app makes them (`builtin-gratitude`, `custom-1767225600000`); the `chk_diaries_default_template_id` constraint holds the same rule. */
export const DIARY_TEMPLATE_ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

/** The optional writing goal, default template and AI mode, sent when creating or updating a diary. */
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
  @Transform(toStrictInt)
  @IsDiaryGoalTarget()
  goalTarget?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 100,
    pattern: DIARY_TEMPLATE_ID_PATTERN.source,
    example: 'builtin-gratitude',
    description: 'Entry template the composer starts from in this diary (built-in or custom ID); null removes it, left out keeps it on update',
  })
  @IsOptional()
  @IsString()
  @Matches(DIARY_TEMPLATE_ID_PATTERN)
  defaultTemplateId?: string | null;

  @ApiPropertyOptional({
    enum: DIARY_AI_MODES,
    example: 'off',
    description: 'Whether the AI features may read the diary’s entries (`on`, the default) or none of them (`off`); left out keeps it on update',
  })
  // Left out keeps the mode; null is refused, as a diary always has one
  @ValidateIf((_dto, value) => value !== undefined)
  @IsIn(DIARY_AI_MODES)
  aiMode?: DiaryAiMode;
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

  @ApiProperty({ type: String, nullable: true, example: '#2A9D8F' })
  color: string | null;

  @ApiProperty({ enum: ['public', 'private'], example: 'private' })
  visibility: 'public' | 'private';

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty()
  position: number;

  @ApiProperty({ enum: DIARY_GOAL_TYPES, nullable: true, example: 'entries_per_week' })
  goalType: DiaryGoalType | null;

  @ApiProperty({ type: Number, nullable: true, example: 3 })
  goalTarget: number | null;

  @ApiProperty({ type: String, nullable: true, example: 'builtin-gratitude', description: 'Entry template the composer starts from in this diary; an ID that no longer resolves is ignored' })
  defaultTemplateId: string | null;

  @ApiProperty({ description: 'Whether the diary is locked behind the writer’s PIN, with every entry in it', example: false })
  isLocked: boolean;

  @ApiProperty({ enum: DIARY_AI_MODES, example: 'on', description: 'Whether the AI features may read the diary’s entries; with `off` none reads them' })
  aiMode: DiaryAiMode;

  @ApiProperty()
  createdAt: Date;
}

export class ReorderDiariesDto {
  @ApiProperty({ description: 'Ordered array of diary IDs', type: [Number] })
  @IsArray()
  @StrictInt({ each: true })
  orderedIds: number[];
}
