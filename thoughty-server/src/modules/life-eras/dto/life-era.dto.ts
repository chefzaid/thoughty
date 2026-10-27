import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO8601, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

/** How many life eras one writer can keep. */
export const LIFE_ERA_LIMIT = 100;
export const LIFE_ERA_NAME_MAX_LENGTH = 50;
export const LIFE_ERA_NOTE_MAX_LENGTH = 500;
export const LIFE_ERA_EMOJI_MAX_LENGTH = 16;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_PATTERN = /^#[0-9A-F]{6}$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Trimmed text, with an empty value read as none. */
const optionalText = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim() === '' ? null : value.trim();
};
const upperColor = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  return value.trim() === '' ? null : value.trim().toUpperCase();
};
const isSet = (_dto: unknown, value: unknown) => value !== null && value !== undefined;

export class CreateLifeEraDto {
  @ApiProperty({ example: 'University', minLength: 1, maxLength: LIFE_ERA_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(LIFE_ERA_NAME_MAX_LENGTH)
  name!: string;

  @ApiProperty({ example: '2010-09-01', format: 'date', description: 'First day of the era' })
  @IsString()
  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true })
  startDate!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    format: 'date',
    example: '2014-06-30',
    description: 'Last day of the era, on or after its start; null or left out while it is still going on',
  })
  @IsOptional()
  @ValidateIf(isSet)
  @IsString()
  @Matches(DATE_PATTERN)
  @IsISO8601({ strict: true })
  endDate?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, example: '#2A9D8F', description: 'Accent colour (#RRGGBB)' })
  @IsOptional()
  @Transform(upperColor)
  @ValidateIf(isSet)
  @IsString()
  @Matches(COLOR_PATTERN, { message: 'color must be a hex colour such as #2A9D8F' })
  color?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, example: '🎓', maxLength: LIFE_ERA_EMOJI_MAX_LENGTH })
  @IsOptional()
  @Transform(optionalText)
  @ValidateIf(isSet)
  @IsString()
  @MaxLength(LIFE_ERA_EMOJI_MAX_LENGTH)
  emoji?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, example: 'Lyon, then a year in Montréal', maxLength: LIFE_ERA_NOTE_MAX_LENGTH })
  @IsOptional()
  @Transform(optionalText)
  @ValidateIf(isSet)
  @IsString()
  @MaxLength(LIFE_ERA_NOTE_MAX_LENGTH)
  note?: string | null;
}

/** The fields to change; the others stay as they are. */
export class UpdateLifeEraDto extends PartialType(CreateLifeEraDto) {}

export class LifeEraResponseDto {
  @ApiProperty({ example: 3 })
  id!: number;

  @ApiProperty({ example: 'University' })
  name!: string;

  @ApiProperty({ example: '2010-09-01', format: 'date' })
  startDate!: string;

  @ApiProperty({ type: String, nullable: true, format: 'date', example: '2014-06-30', description: 'Null while the era is still going on' })
  endDate!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '#2A9D8F' })
  color!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '🎓' })
  emoji!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Lyon, then a year in Montréal' })
  note!: string | null;

  @ApiProperty({ example: '2026-10-27T09:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-27T09:30:00.000Z' })
  updatedAt!: Date;
}

export class LifeEraListResponseDto {
  @ApiProperty({ type: [LifeEraResponseDto], description: 'By start date, then name' })
  lifeEras!: LifeEraResponseDto[];

  @ApiProperty({ example: LIFE_ERA_LIMIT, description: 'How many life eras a writer can keep' })
  limit!: number;
}
