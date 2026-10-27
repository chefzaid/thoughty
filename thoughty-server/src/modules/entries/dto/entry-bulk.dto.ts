// Operations on many entries at once: bulk actions, reordering a day, and deleting all entries.
import {
  IsString,
  IsArray,
  IsOptional,
  IsEnum,
  IsDateString,
  MaxLength,
  ArrayMaxSize,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StrictBoolean, StrictInt } from '@/common/validation';

export class BulkOperationDto {
  @ApiProperty({ description: 'Entry IDs to operate on', type: [Number] })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one entry ID is required' })
  @StrictInt({ each: true })
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
  @StrictInt()
  diaryId?: number;

  @ApiPropertyOptional({ description: 'Whether the entries should be archived' })
  @IsOptional()
  @StrictBoolean()
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
  @StrictInt({ each: true })
  orderedIds: number[];
}

export class DeleteAllQueryDto {
  @ApiPropertyOptional({ description: 'Diary ID to delete entries from' })
  @IsOptional()
  @StrictInt()
  diaryId?: number;
}
