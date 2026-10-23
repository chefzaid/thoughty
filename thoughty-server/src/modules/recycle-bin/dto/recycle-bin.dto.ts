import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, Max, Min } from 'class-validator';

/** How long a deleted entry stays in the recycle bin before it is removed for good. */
export const RECYCLE_BIN_RETENTION_DAYS = 30;
export const RECYCLE_BIN_PAGE_SIZE_MAX = 50;
export const RECYCLE_BIN_SELECTION_MAX = 100;

export class RecycleBinQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: RECYCLE_BIN_PAGE_SIZE_MAX, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RECYCLE_BIN_PAGE_SIZE_MAX)
  limit?: number = 20;
}

export class RecycleBinSelectionDto {
  @ApiProperty({ example: [12, 15], type: [Number], description: 'Entries in the recycle bin' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(RECYCLE_BIN_SELECTION_MAX)
  @IsInt({ each: true })
  @Min(1, { each: true })
  ids!: number[];
}

export class TrashedEntryDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: '2026-10-21', format: 'date' })
  date!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Morning walk by the river' })
  title!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '08:30', description: 'Time of day (HH:MM), or null' })
  timeOfDay!: string | null;

  @ApiProperty({ example: 'Walked by the river before work and finally felt rested.' })
  content!: string;

  @ApiProperty({ enum: ['plain', 'markdown'], example: 'plain' })
  format!: 'plain' | 'markdown';

  @ApiProperty({ type: [String], example: ['walks'] })
  tags!: string[];

  @ApiProperty({ type: Number, nullable: true, example: 2, description: 'Diary the entry returns to; null when that diary is gone' })
  diaryId!: number | null;

  @ApiProperty({ type: String, nullable: true, example: 'Daily Journal' })
  diaryName!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '📓' })
  diaryIcon!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '#2A9D8F' })
  diaryColor!: string | null;

  @ApiProperty({ example: 1, description: 'Files kept with the entry until it is restored or removed' })
  attachmentCount!: number;

  @ApiProperty({ example: '2026-10-22T08:30:00.000Z', format: 'date-time' })
  deletedAt!: string;

  @ApiProperty({ example: '2026-11-21T08:30:00.000Z', format: 'date-time', description: 'When the entry is removed for good' })
  purgeAt!: string;
}

export class RecycleBinListResponseDto {
  @ApiProperty({ type: [TrashedEntryDto] })
  entries!: TrashedEntryDto[];

  @ApiProperty({ example: 1 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;

  @ApiProperty({ example: RECYCLE_BIN_RETENTION_DAYS })
  retentionDays!: number;
}

export class RecycleBinRestoreResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 2 })
  restoredCount!: number;

  @ApiProperty({
    example: 0,
    description: 'Restored entries whose diary no longer exists and went to the default diary',
  })
  movedToDefaultCount!: number;
}

export class RecycleBinDeleteResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 2 })
  deletedCount!: number;
}
