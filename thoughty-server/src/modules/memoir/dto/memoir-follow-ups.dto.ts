import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { MAX_MEMOIR_FOLLOW_UP_LENGTH, MAX_MEMOIR_FOLLOW_UPS } from '@/modules/ai/memoir-follow-ups';
import { MEMOIR_ANSWER_MAX_LENGTH } from './memoir.dto';

/** Follow-ups offered for one answer are sent back, so a new round asks other ones. */
export const MEMOIR_FOLLOW_UPS_MAX_ASKED = 12;

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** An answer being written, for follow-up questions that deepen it. */
export class MemoirFollowUpsDto {
  @ApiProperty({ example: 'childhood-home', maxLength: 64 })
  @IsString()
  @Matches(/^[a-z][a-z-]{0,63}$/)
  questionId!: string;

  @ApiProperty({
    example: 'A narrow house with a fig tree in the yard and my grandmother singing in the kitchen.',
    minLength: 1,
    maxLength: MEMOIR_ANSWER_MAX_LENGTH,
    description: 'The answer written so far; may not be empty',
  })
  @Transform(trimmed)
  @IsString()
  @MinLength(1)
  @MaxLength(MEMOIR_ANSWER_MAX_LENGTH)
  text!: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: MEMOIR_FOLLOW_UPS_MAX_ASKED,
    example: ['What song did your grandmother sing in the kitchen?'],
    description: 'Follow-ups already offered for this answer, so none is asked again',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MEMOIR_FOLLOW_UPS_MAX_ASKED)
  @IsString({ each: true })
  @MaxLength(MAX_MEMOIR_FOLLOW_UP_LENGTH, { each: true })
  asked?: string[];
}

export class MemoirFollowUpsResponseDto {
  @ApiProperty({
    type: [String],
    maxItems: MAX_MEMOIR_FOLLOW_UPS,
    example: ['What song did your grandmother sing in the kitchen?', 'What could you see from under the fig tree?'],
    description: 'Up to three follow-up questions grounded in the answer; empty when it gives nothing to build on yet',
  })
  questions!: string[];
}
