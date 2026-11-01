import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PEOPLE_LIMIT } from '@/modules/entries/entry-mentions.sync';
import { StrictInt } from '@/common/validation';
import { PERSON_DATE_KINDS, type PersonDateKind } from '@/database/entities/person.entity';
import { PERSON_DATE_MIN_YEAR } from '../person-dates';

export const PERSON_NAME_MAX_LENGTH = 80;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const KIND_DESCRIPTION = 'What the date marks: a birthday or an anniversary (a wedding, a meeting, a loss)';

/** A birthday or an anniversary as the writer gives it: the month and day, and the year when they know it. */
export class PersonDateInputDto {
  @ApiProperty({ enum: PERSON_DATE_KINDS, enumName: 'PersonDateKind', example: 'birthday', description: KIND_DESCRIPTION })
  @IsIn(PERSON_DATE_KINDS)
  kind!: PersonDateKind;

  @ApiProperty({ example: 3, minimum: 1, maximum: 12 })
  @StrictInt()
  month!: number;

  @ApiProperty({
    example: 14,
    minimum: 1,
    maximum: 31,
    description: 'A day the month has (`400 PERSON_DATE_INVALID` otherwise); 29 February only in a leap year when the year is given',
  })
  @StrictInt()
  day!: number;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 1992,
    minimum: PERSON_DATE_MIN_YEAR,
    description:
      'The year, when the writer knows it: four digits (`400 PERSON_DATE_YEAR_INVALID`), and with it the date ' +
      'cannot be later than today anywhere on Earth (`400 PERSON_DATE_IN_FUTURE`). Null or left out when unknown.',
  })
  @IsOptional()
  @StrictInt()
  year?: number | null;
}

/** The name shown for a person, and their date. Their handles, and so the text of entries, stay as they are. */
export class UpdatePersonDto {
  @ApiProperty({ example: 'Marie Curie', minLength: 1, maxLength: PERSON_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(PERSON_NAME_MAX_LENGTH)
  name!: string;

  @ApiPropertyOptional({
    type: () => PersonDateInputDto,
    nullable: true,
    description: 'Their birthday or anniversary, shown in Highlights each year on its day; null removes it, left out keeps it',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonDateInputDto)
  date?: PersonDateInputDto | null;
}

export class MergePersonDto {
  @ApiProperty({
    example: 14,
    description: 'The duplicate to merge into this person: its handles and entries move here, then it is deleted',
  })
  @StrictInt()
  @Min(1)
  duplicateId!: number;
}

export class PersonDateDto {
  @ApiProperty({ enum: PERSON_DATE_KINDS, enumName: 'PersonDateKind', example: 'birthday', description: KIND_DESCRIPTION })
  kind!: PersonDateKind;

  @ApiProperty({ example: 3, minimum: 1, maximum: 12 })
  month!: number;

  @ApiProperty({ example: 14, minimum: 1, maximum: 31 })
  day!: number;

  @ApiProperty({ type: Number, nullable: true, example: 1992, description: 'Null when the writer does not know the year' })
  year!: number | null;
}

export class PersonResponseDto {
  @ApiProperty({ example: 12 })
  id!: number;

  @ApiProperty({ example: 'Marie', description: 'The name shown; the handle as first written until the writer changes it' })
  name!: string;

  @ApiProperty({
    type: [String],
    example: ['marie', 'marie-c'],
    description: 'Handles that mention the person, without the @ and in lower case, the first one first',
  })
  handles!: string[];

  @ApiProperty({ example: 8, minimum: 0, description: 'Entries that mention the person, leaving out the recycle bin' })
  entryCount!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    format: 'date',
    example: '2026-10-21',
    description: 'Date of the latest entry that mentions the person; null when none does',
  })
  lastMentionedOn!: string | null;

  @ApiProperty({
    type: () => PersonDateDto,
    nullable: true,
    description: 'Their birthday or anniversary, shown in Highlights on its day; null when none is set',
  })
  date!: PersonDateDto | null;

  @ApiProperty({ example: '2026-10-27T09:30:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-10-27T09:30:00.000Z' })
  updatedAt!: Date;
}

export class PersonListResponseDto {
  @ApiProperty({ type: [PersonResponseDto], description: 'By name' })
  people!: PersonResponseDto[];

  @ApiProperty({ example: PEOPLE_LIMIT, description: 'How many people a writer can keep; mentions of new people past it stay plain text' })
  limit!: number;
}
