// Operations on many entries at once: bulk actions, reordering a day, and deleting all entries.
import {
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  ArrayMaxSize,
  IsNumber,
  IsInt,
  ArrayMinSize,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

export class BulkOperationDto {
  @ApiProperty({ description: 'Entry IDs to operate on', type: [Number] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one entry ID is required' })
  @IsInt({ each: true })
  @Type(() => Number)
  ids: number[];

  @ApiProperty({
    description: 'Bulk action to perform',
    enum: ['delete', 'visibility', 'tags', 'move', 'archive'],
  })
  @IsEnum(['delete', 'visibility', 'tags', 'move', 'archive'])
  action: 'delete' | 'visibility' | 'tags' | 'move' | 'archive';

  @ApiPropertyOptional({ enum: ['public', 'private'] })
  @IsOptional()
  @IsEnum(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ description: 'Tags to set on entries', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Diary ID to move entries to' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  diaryId?: number;

  @ApiPropertyOptional({ description: 'Whether the entries should be archived' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === 'true')
  isArchived?: boolean;
}

export class ReorderEntriesDto {
  @ApiProperty({ description: 'Date of the entries to reorder (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({
    description:
      'Entry IDs in the desired order: all of the day\'s entries, or some of them (such as those without a ' +
      'time), which then trade the same-day indexes they hold among themselves',
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one entry ID is required' })
  @IsInt({ each: true })
  @Type(() => Number)
  orderedIds: number[];
}

export class DeleteAllQueryDto {
  @ApiPropertyOptional({ description: 'Diary ID to delete entries from' })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  diaryId?: number;
}
