import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const journalRetagModes = ['replace', 'add'] as const;
export type JournalRetagMode = (typeof journalRetagModes)[number];

export class JournalRetagEntryDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  date: string;

  @ApiProperty()
  index: number;

  @ApiProperty({ type: [String] })
  currentTags: string[];

  @ApiProperty({ type: [String] })
  suggestedTags: string[];
}

export class JournalRetagPlanResponseDto {
  @ApiProperty()
  analyzedEntries: number;

  @ApiProperty()
  totalEntries: number;

  @ApiProperty()
  truncated: boolean;

  @ApiProperty({ type: [String] })
  themes: string[];

  @ApiProperty({ type: [JournalRetagEntryDto] })
  entries: JournalRetagEntryDto[];
}

export class JournalRetagAssignmentDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  entryId: number;

  @ApiProperty({ type: [String], maxItems: 3 })
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags: string[];
}

export class ApplyJournalRetagDto {
  @ApiProperty({ enum: journalRetagModes })
  @IsString()
  @IsIn(journalRetagModes)
  mode: JournalRetagMode;

  @ApiProperty({ type: [JournalRetagAssignmentDto], maxItems: 300 })
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => JournalRetagAssignmentDto)
  assignments: JournalRetagAssignmentDto[];
}

export class ApplyJournalRetagResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  affectedEntries: number;
}
