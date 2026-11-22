import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';
import { MEMOIR_CHAPTERS } from '../memoir-questions';
import { MEMOIR_ANSWER_MAX_LENGTH } from './memoir.dto';

export const MEMOIR_PHOTO_CAPTION_MAX_LENGTH = 200;
const MEMOIR_CHAPTER_IDS = MEMOIR_CHAPTERS.map((chapter) => chapter.id);

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** A photo prompt answered: an uploaded old photo and the story of what is happening in it. */
export class AnswerMemoirPhotoDto {
  @ApiProperty({ example: 57, description: 'The uploaded photo (JPEG, PNG, GIF or WebP), on no entry yet' })
  @StrictInt()
  @Min(1)
  attachmentId!: number;

  @ApiProperty({
    example: 'My grandfather on the day he opened his bakery, flour still on his hands.',
    maxLength: MEMOIR_ANSWER_MAX_LENGTH,
    description: 'What is happening in the photo; may not be empty',
  })
  @Transform(trimmed)
  @IsString()
  @MaxLength(MEMOIR_ANSWER_MAX_LENGTH)
  text!: string;

  @ApiPropertyOptional({
    example: 'The bakery on Rue Saint-Jean, 1962',
    maxLength: MEMOIR_PHOTO_CAPTION_MAX_LENGTH,
    description: 'Describes the photo: its alt text in the entry and its caption in books',
  })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(MEMOIR_PHOTO_CAPTION_MAX_LENGTH)
  caption?: string;

  @ApiPropertyOptional({
    enum: MEMOIR_CHAPTER_IDS,
    example: 'family',
    description: 'The life chapter the photo belongs to: its title tags the story, so the book places it there. Omit for the Photos chapter',
  })
  @IsOptional()
  @IsIn(MEMOIR_CHAPTER_IDS)
  chapterId?: string;

  @ApiPropertyOptional({ example: 3, description: 'Life era the photo belongs to: the story is also tagged with the era’s name' })
  @IsOptional()
  @StrictInt()
  @Min(1)
  eraId?: number;
}

export class MemoirPhotoAnswerResultDto {
  @ApiProperty({ example: 815, description: 'The private entry in the memoir diary that holds the photo and its story' })
  entryId!: number;
}
