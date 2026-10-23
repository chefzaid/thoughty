import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MAX_ENTRY_TITLE_LENGTH, TIME_OF_DAY_PATTERN } from '@/common/utils/entry-order.util';
import { MAX_MOOD, MIN_MOOD } from '@/common/utils/entry-mood.util';

export const APP_IMPORT_SOURCES = ['dayone', 'journey'] as const;
export type AppImportSource = (typeof APP_IMPORT_SOURCES)[number];
export const MAX_APP_IMPORT_ENTRIES = 200;
export const MAX_IMPORT_FILES = 8;

export class AppImportEntryDto {
  @ApiProperty({ description: 'ID of the entry in the source app; an entry already imported is not imported again' })
  @IsString()
  @Matches(/^[A-Za-z0-9._:-]{1,100}$/)
  sourceId: string;

  @ApiProperty({ description: 'Local day the entry was written', example: '2024-03-05' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsISO8601({ strict: true })
  date: string;

  @ApiPropertyOptional({ description: 'Local time of day the entry was written (HH:MM)', example: '08:30' })
  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN)
  timeOfDay?: string;

  @ApiPropertyOptional({ description: 'Title of the entry in the source app', example: 'Morning walk by the river' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ENTRY_TITLE_LENGTH)
  title?: string;

  @ApiPropertyOptional({
    description: 'Mood the writer recorded in the source app, on the scale from 1 (very low) to 5 (very good)',
    minimum: MIN_MOOD,
    maximum: MAX_MOOD,
    example: 4,
  })
  @IsOptional()
  @IsInt()
  @Min(MIN_MOOD)
  @Max(MAX_MOOD)
  mood?: number;

  @ApiProperty({ description: 'Entry text as Markdown; may be empty when the entry holds only photos' })
  @IsString()
  @MaxLength(50000)
  content: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  favorite?: boolean;

  @ApiPropertyOptional({ description: 'Name of the journal the entry belongs to in the source app' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  journal?: string;
}

export class AppImportDto {
  @ApiProperty({ enum: APP_IMPORT_SOURCES })
  @IsIn(APP_IMPORT_SOURCES)
  source: AppImportSource;

  @ApiProperty({ type: [AppImportEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_APP_IMPORT_ENTRIES)
  @ValidateNested({ each: true })
  @Type(() => AppImportEntryDto)
  entries: AppImportEntryDto[];

  @ApiPropertyOptional({ description: 'Diary for the entries; defaults to the default diary' })
  @IsOptional()
  @IsInt()
  @Min(1)
  diaryId?: number;

  @ApiPropertyOptional({ description: 'Put each source journal in the diary of the same name, creating the missing ones' })
  @IsOptional()
  @IsBoolean()
  journalsAsDiaries?: boolean;
}

export class AppImportedEntryDto {
  @ApiProperty()
  sourceId: string;

  @ApiProperty()
  entryId: number;

  @ApiProperty({ description: 'True when an earlier import already brought this entry in' })
  alreadyImported: boolean;

  @ApiProperty({ type: [String], description: 'Names of the files already attached to the entry' })
  attachedFiles: string[];
}

export class AppImportResponseDto {
  @ApiProperty({ type: [AppImportedEntryDto] })
  entries: AppImportedEntryDto[];

  @ApiProperty()
  importedCount: number;

  @ApiProperty()
  alreadyImportedCount: number;

  @ApiProperty({ type: [String], description: 'Diaries created for source journals' })
  createdDiaries: string[];
}

export class ImportAttachmentsDto {
  @ApiProperty({ description: 'Entry ID for each uploaded file, comma-separated in file order', example: '12,12,13' })
  @IsString()
  @Matches(new RegExp(String.raw`^\d{1,10}(,\d{1,10}){0,${MAX_IMPORT_FILES - 1}}$`))
  entryIds: string;
}

export class ImportedAttachmentDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  entryId: number;

  @ApiProperty()
  originalFilename: string;
}

export class ImportAttachmentsResponseDto {
  @ApiProperty({ type: [ImportedAttachmentDto] })
  attachments: ImportedAttachmentDto[];
}
