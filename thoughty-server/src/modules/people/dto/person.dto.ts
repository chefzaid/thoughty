import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PEOPLE_LIMIT } from '@/modules/entries/entry-mentions.sync';
import { StrictInt } from '@/common/validation';
import { LOCAL_DAY_PATTERN } from '@/common/utils/writers-day.util';
import { PERSON_DATE_KINDS, type PersonDateKind } from '@/database/entities/person.entity';
import { PERSON_DATE_MIN_YEAR } from '../person-dates';
import { PERSON_GROUP_NAME_MAX_LENGTH, PERSON_GROUPS_MAX } from '../person-groups';
import { REACH_OUT_DAYS } from '../person-reach-out';

export const PERSON_NAME_MAX_LENGTH = 80;
/** The longest notes the writer can save on a person. */
export const PERSON_NOTES_MAX_LENGTH = 2000;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** Trimmed notes, with blank ones read as none. */
const trimNotes = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() || null : value);
/** Each group name trimmed. */
const trimEach = ({ value }: { value: unknown }) => (Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item.trim() : item)) : value);

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

/**
 * The name shown for a person, their date, their reach-out reminder, the writer's notes on them and their groups. Their
 * handles, and so the text of entries, stay as they are.
 */
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

  @ApiPropertyOptional({
    enum: REACH_OUT_DAYS,
    nullable: true,
    example: 30,
    description:
      'Remind the writer in Highlights to reach out once this many days have passed since the last contact or the newest ' +
      'mention; null turns the reminder off, left out keeps it',
  })
  @IsOptional()
  @IsIn(REACH_OUT_DAYS)
  reachOutDays?: number | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-11-03',
    description:
      'The last day the writer was in touch with the person (YYYY-MM-DD), not after today anywhere on Earth ' +
      '(`400 PERSON_CONTACT_IN_FUTURE`); null removes it, left out keeps it',
  })
  @IsOptional()
  @Matches(LOCAL_DAY_PATTERN)
  @IsDateString({ strict: true })
  lastContactOn?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: PERSON_NOTES_MAX_LENGTH,
    example: 'Met at the climbing gym in 2019. Loves Japanese novels.',
    description:
      'The writer’s own notes on the person, trimmed; null or blank removes them, left out keeps them. Merging two ' +
      'people joins their notes, which may then be longer than a save accepts.',
  })
  @IsOptional()
  @Transform(trimNotes)
  @IsString()
  @MaxLength(PERSON_NOTES_MAX_LENGTH)
  notes?: string | null;

  @ApiPropertyOptional({
    type: [String],
    maxItems: PERSON_GROUPS_MAX,
    example: ['Friends', 'Climbing'],
    description:
      `The writer’s own groups the person belongs to, each name trimmed, 1 to ${PERSON_GROUP_NAME_MAX_LENGTH} characters, ` +
      `at most ${PERSON_GROUPS_MAX}; a name given twice ignoring case is kept once, and one the writer already gives ` +
      'another person in other letter case takes that spelling. An empty list removes them all, left out keeps them. ' +
      'Merging two people joins their groups, which may then be more than a save accepts.',
  })
  @ValidateIf((_dto, value) => value !== undefined)
  @Transform(trimEach)
  @IsArray()
  @ArrayMaxSize(PERSON_GROUPS_MAX)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(PERSON_GROUP_NAME_MAX_LENGTH, { each: true })
  groups?: string[];
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

  @ApiProperty({
    enum: REACH_OUT_DAYS,
    nullable: true,
    example: 30,
    description: 'The reach-out reminder: at most this many days without being in touch; null when there is none',
  })
  reachOutDays!: number | null;

  @ApiProperty({ type: String, nullable: true, format: 'date', example: '2026-11-03', description: 'The last contact the writer recorded; null when none is' })
  lastContactOn!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Met at the climbing gym in 2019. Loves Japanese novels.',
    description: 'The writer’s own notes on the person; null when there are none',
  })
  notes!: string | null;

  @ApiProperty({
    type: [String],
    example: ['Friends', 'Climbing'],
    description: 'The writer’s own groups the person belongs to, in the order the writer gave them; empty when none',
  })
  groups!: string[];

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
