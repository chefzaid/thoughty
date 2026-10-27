import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StrictBoolean, StrictInt } from '@/common/validation';

export class FormatConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  entrySeparator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sameDaySeparator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  datePrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateSuffix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFormat?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tagOpenBracket?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tagCloseBracket?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tagSeparator?: string;

  @ApiPropertyOptional({
    description:
      'Where TXT files keep entry titles: on the header line as --{title:...}, or as the first line under ' +
      'the header (empty when the entry has none)',
    enum: ['header', 'firstLine'],
    default: 'header',
  })
  @IsOptional()
  @IsIn(['header', 'firstLine'])
  titlePlacement?: 'header' | 'firstLine';
}

export class ExportQueryDto {
  @ApiPropertyOptional({ description: 'Diary ID to filter export' })
  @IsOptional()
  @StrictInt()
  diaryId?: number;

  @ApiPropertyOptional({ description: 'Include visibility field in export', default: false })
  @IsOptional()
  @StrictBoolean()
  includeVisibility?: boolean;

  @ApiPropertyOptional({
    description: 'Export file format; `zip` is a Markdown folder with one file per entry and its attachments',
    enum: ['txt', 'json', 'md', 'csv', 'pdf', 'html', 'epub', 'zip'],
    default: 'txt',
  })
  @IsOptional()
  @IsIn(['txt', 'json', 'md', 'csv', 'pdf', 'html', 'epub', 'zip'])
  format?: 'txt' | 'json' | 'md' | 'csv' | 'pdf' | 'html' | 'epub' | 'zip';
}

export class PreviewImportDto {
  @ApiProperty({ description: 'File content to preview' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Diary ID' })
  @IsOptional()
  @StrictInt()
  diaryId?: number;
}

export class ImportDto {
  @ApiProperty({ description: 'File content to import' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Skip duplicate entries', default: true })
  @IsOptional()
  @StrictBoolean()
  skipDuplicates?: boolean;

  @ApiPropertyOptional({ description: 'Diary ID' })
  @IsOptional()
  @StrictInt()
  diaryId?: number;
}

/** An entry read from the file, before it is imported. */
export class PreviewEntryDto {
  @ApiProperty({ example: '2026-10-21' })
  date: string;

  @ApiProperty({ example: 1 })
  index: number;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Time of day (HH:MM)', example: '08:30' })
  timeOfDay?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  mood?: number;

  @ApiPropertyOptional({ type: [String] })
  feelings?: string[];

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: ['plain', 'markdown'] })
  format: 'plain' | 'markdown';

  @ApiPropertyOptional({ enum: ['public', 'private'] })
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ description: 'The diary the file names for this entry' })
  diaryName?: string;
}

/** An entry in the file that is already in the journal. */
export class PreviewDuplicateDto {
  @ApiProperty({ example: '2026-10-21' })
  date: string;

  @ApiProperty({ description: 'The first 100 characters of the entry' })
  content: string;
}

export class PreviewResponseDto {
  @ApiProperty({ type: [PreviewEntryDto] })
  entries: PreviewEntryDto[];

  @ApiProperty()
  totalCount: number;

  @ApiProperty({ type: [PreviewDuplicateDto] })
  duplicates: PreviewDuplicateDto[];

  @ApiProperty()
  duplicateCount: number;
}

export class ImportResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  importedCount: number;

  @ApiProperty()
  skippedCount: number;

  @ApiProperty()
  totalProcessed: number;
}

/** The TXT file layout in use: the saved settings, with defaults for the ones never saved. */
export class FormatConfigResponseDto {
  @ApiProperty({ description: 'Line between two days' })
  entrySeparator: string;

  @ApiProperty({ description: 'Line between two entries of the same day' })
  sameDaySeparator: string;

  @ApiProperty()
  datePrefix: string;

  @ApiProperty()
  dateSuffix: string;

  @ApiProperty({ example: 'YYYY-MM-DD' })
  dateFormat: string;

  @ApiProperty()
  tagOpenBracket: string;

  @ApiProperty()
  tagCloseBracket: string;

  @ApiProperty()
  tagSeparator: string;

  @ApiProperty({ enum: ['header', 'firstLine'] })
  titlePlacement: 'header' | 'firstLine';
}

export class SaveFormatResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ type: FormatConfigResponseDto, description: 'The settings as saved, with defaults filled in' })
  config: FormatConfigResponseDto;
}
