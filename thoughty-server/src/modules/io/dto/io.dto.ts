import { IsString, IsOptional, IsBoolean, IsNumber, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

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
}

export class ExportQueryDto {
  @ApiPropertyOptional({ description: 'Diary ID to filter export' })
  @IsOptional()
  @Transform(({ value }) => Number.parseInt(value, 10))
  @IsNumber()
  diaryId?: number;

  @ApiPropertyOptional({ description: 'Include visibility field in export', default: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeVisibility?: boolean;

  @ApiPropertyOptional({ description: 'Export file format', enum: ['txt', 'json', 'md', 'pdf', 'html', 'epub'], default: 'txt' })
  @IsOptional()
  @IsIn(['txt', 'json', 'md', 'pdf', 'html', 'epub'])
  format?: 'txt' | 'json' | 'md' | 'pdf' | 'html' | 'epub';
}

export class PreviewImportDto {
  @ApiProperty({ description: 'File content to preview' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Diary ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  diaryId?: number;
}

export class ImportDto {
  @ApiProperty({ description: 'File content to import' })
  @IsString()
  content: string;

  @ApiPropertyOptional({ description: 'Skip duplicate entries', default: true })
  @IsOptional()
  @IsBoolean()
  skipDuplicates?: boolean;

  @ApiPropertyOptional({ description: 'Diary ID' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  diaryId?: number;
}

export class PreviewResponseDto {
  @ApiProperty()
  entries: Array<{
    date: string;
    index: number;
    tags: string[];
    content: string;
  }>;

  @ApiProperty()
  totalCount: number;

  @ApiProperty()
  duplicates: Array<{
    date: string;
    content: string;
  }>;

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
