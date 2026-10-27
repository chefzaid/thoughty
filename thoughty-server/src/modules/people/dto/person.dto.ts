import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PEOPLE_LIMIT } from '@/modules/entries/entry-mentions.sync';

export const PERSON_NAME_MAX_LENGTH = 80;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** The name shown for a person. Their handles, and so the text of entries, stay as they are. */
export class UpdatePersonDto {
  @ApiProperty({ example: 'Marie Curie', minLength: 1, maxLength: PERSON_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(PERSON_NAME_MAX_LENGTH)
  name!: string;
}

export class MergePersonDto {
  @ApiProperty({
    example: 14,
    description: 'The duplicate to merge into this person: its handles and entries move here, then it is deleted',
  })
  @IsInt()
  @Min(1)
  duplicateId!: number;
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
