import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { MemoirProgramStatus } from '@/database/entities';
import { StrictBoolean, StrictInt } from '@/common/validation';

export const MEMOIR_ANSWER_MAX_LENGTH = 45_000;
export const MEMOIR_ANSWER_MAX_ATTACHMENTS = 5;
const MEMOIR_PROGRAM_STATUSES: MemoirProgramStatus[] = ['active', 'paused'];

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class StartMemoirDto {
  @ApiPropertyOptional({ example: 4, description: 'An existing diary to collect the answers; omit to create one named diaryName' })
  @IsOptional()
  @StrictInt()
  @Min(1)
  diaryId?: number;

  @ApiPropertyOptional({ example: 'My memoir', maxLength: 100, description: 'Name of the diary to create (or reuse) when diaryId is omitted' })
  @ValidateIf((dto: StartMemoirDto) => dto.diaryId === undefined)
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  diaryName?: string;

  @ApiProperty({ example: true, description: 'Email each weekly question' })
  @StrictBoolean()
  emailEnabled!: boolean;

  @ApiProperty({ example: 0, minimum: 0, maximum: 6, description: '0 = Sunday through 6 = Saturday' })
  @StrictInt()
  @Min(0)
  @Max(6)
  deliveryWeekday!: number;

  @ApiProperty({ example: 'Europe/Paris', maxLength: 64, description: 'IANA time zone for the 09:00 weekly delivery' })
  @IsString()
  @MaxLength(64)
  timeZone!: string;
}

export class UpdateMemoirDto {
  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @StrictInt()
  @Min(1)
  diaryId?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @StrictBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ example: 3, minimum: 0, maximum: 6 })
  @IsOptional()
  @StrictInt()
  @Min(0)
  @Max(6)
  deliveryWeekday?: number;

  @ApiPropertyOptional({ example: 'Europe/Paris', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;

  @ApiPropertyOptional({ enum: MEMOIR_PROGRAM_STATUSES, example: 'paused', description: 'Paused programs get no new weekly question or email' })
  @IsOptional()
  @IsIn(MEMOIR_PROGRAM_STATUSES)
  status?: MemoirProgramStatus;
}

export class AnswerMemoirQuestionDto {
  @ApiProperty({ example: 'childhood-home', maxLength: 64 })
  @IsString()
  @Matches(/^[a-z][a-z-]{0,63}$/)
  questionId!: string;

  @ApiProperty({
    example: 'A narrow house with a fig tree in the yard and my grandmother singing in the kitchen.',
    maxLength: MEMOIR_ANSWER_MAX_LENGTH,
    description: 'The answer; may be empty when a voice recording is attached',
  })
  @Transform(trimmed)
  @IsString()
  @MaxLength(MEMOIR_ANSWER_MAX_LENGTH)
  text!: string;

  @ApiPropertyOptional({ type: [Number], example: [31], maxItems: MEMOIR_ANSWER_MAX_ATTACHMENTS, description: 'Uploaded attachments (such as a voice recording) to keep with the answer' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MEMOIR_ANSWER_MAX_ATTACHMENTS)
  @StrictInt({ each: true })
  @Min(1, { each: true })
  attachmentIds?: number[];

  @ApiPropertyOptional({
    example: 3,
    description: 'Life era the memory belongs to: the answer is also tagged with the era’s name',
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  eraId?: number;
}

export class LocalizedTextDto {
  @ApiProperty({ example: 'What did the home you grew up in look, sound, and smell like?' })
  en!: string;

  @ApiProperty({ example: 'À quoi ressemblait la maison de votre enfance : ses pièces, ses bruits, ses odeurs ?' })
  fr!: string;
}

export class MemoirAnswerRefDto {
  @ApiProperty({ example: 812 })
  entryId!: number;

  @ApiProperty({ example: '2026-10-12T09:41:00.000Z' })
  answeredAt!: string;
}

export class MemoirQuestionDto {
  @ApiProperty({ example: 'childhood-home' })
  id!: string;

  @ApiProperty({ type: LocalizedTextDto })
  text!: LocalizedTextDto;

  @ApiProperty({ type: MemoirAnswerRefDto, nullable: true })
  answer!: MemoirAnswerRefDto | null;
}

export class MemoirChapterDto {
  @ApiProperty({ example: 'childhood' })
  id!: string;

  @ApiProperty({ type: LocalizedTextDto })
  title!: LocalizedTextDto;

  @ApiProperty({ type: [MemoirQuestionDto] })
  questions!: MemoirQuestionDto[];
}

export class MemoirProgramDto {
  @ApiProperty({ type: Number, nullable: true, example: 4, description: 'Null when the memoir diary was deleted' })
  diaryId!: number | null;

  @ApiProperty({ enum: MEMOIR_PROGRAM_STATUSES, example: 'active' })
  status!: MemoirProgramStatus;

  @ApiProperty({ example: true })
  emailEnabled!: boolean;

  @ApiProperty({ example: false, description: 'Whether weekly emails can reach this account (mail is configured and the address verified)' })
  emailAvailable!: boolean;

  @ApiProperty({ example: 0, minimum: 0, maximum: 6 })
  deliveryWeekday!: number;

  @ApiProperty({ example: 'Europe/Paris' })
  timeZone!: string;

  @ApiProperty({ type: String, nullable: true, example: 'childhood-play', description: "This week's question; null once every question is answered" })
  currentQuestionId!: string | null;

  @ApiProperty({ example: '2026-10-25T08:00:00.000Z' })
  nextDeliveryAt!: string;

  @ApiProperty({ example: '2026-10-04T15:20:00.000Z' })
  startedAt!: string;
}

export class MemoirProgressDto {
  @ApiProperty({ example: 12 })
  answered!: number;

  @ApiProperty({ example: 52 })
  total!: number;

  @ApiProperty({ example: 8400, description: 'Words written in the answers, question headings excluded' })
  words!: number;

  @ApiProperty({ example: 34, description: 'Approximate printed pages at 250 words per page' })
  estimatedPages!: number;
}

export class MemoirOverviewDto {
  @ApiProperty({ type: MemoirProgramDto, nullable: true, description: 'Null until the program is started' })
  program!: MemoirProgramDto | null;

  @ApiProperty({ type: [MemoirChapterDto] })
  chapters!: MemoirChapterDto[];

  @ApiProperty({ type: MemoirProgressDto })
  progress!: MemoirProgressDto;
}

export class MemoirAnswerResultDto {
  @ApiProperty({ example: 'childhood-home' })
  questionId!: string;

  @ApiProperty({ example: 812 })
  entryId!: number;
}

export class MemoirLeftDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
