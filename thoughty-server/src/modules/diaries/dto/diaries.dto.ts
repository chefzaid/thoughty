import { IsString, IsOptional, IsEnum, MaxLength, IsArray, IsInt, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const DIARY_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export class CreateDiaryDto {
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

export class UpdateDiaryDto {
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

  @ApiProperty()
  createdAt: Date;
}

export class ReorderDiariesDto {
  @ApiProperty({ description: 'Ordered array of diary IDs', type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  orderedIds: number[];
}
