import { ApiProperty } from '@nestjs/swagger';
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
  ValidateIf,
} from 'class-validator';
import { StrictInt } from '@/common/validation';
import { MAX_ENTRY_TITLE_LENGTH } from '@/common/utils/entry-order.util';
import { MAX_FEELING_LENGTH, MAX_FEELINGS, MAX_MOOD, MIN_MOOD } from '@/common/utils/entry-mood.util';

/** The entry's own limits: a draft holds no more than the entry it becomes. */
export const MAX_DRAFT_TEXT_LENGTH = 50_000;
export const MAX_DRAFT_TAGS = 20;
export const MAX_DRAFT_TAG_LENGTH = 50;

const nullable = (_dto: object, value: unknown) => value !== null;

/** The composer fields a draft keeps: its text, title, tags, format, mood and feelings. */
export class ComposerDraftFieldsDto {
  @ApiProperty({ example: 'We walked along the river until the light went.', maxLength: MAX_DRAFT_TEXT_LENGTH })
  @IsString()
  @MaxLength(MAX_DRAFT_TEXT_LENGTH, { message: `Content exceeds maximum length of ${MAX_DRAFT_TEXT_LENGTH} characters` })
  text!: string;

  @ApiProperty({ type: String, nullable: true, maxLength: MAX_ENTRY_TITLE_LENGTH, example: 'Evening walk' })
  @ValidateIf(nullable)
  @IsString()
  @MaxLength(MAX_ENTRY_TITLE_LENGTH)
  @Matches(/^[^\r\n]*$/, { message: 'Title must be one line' })
  title!: string | null;

  @ApiProperty({ type: [String], maxItems: MAX_DRAFT_TAGS, example: ['walks'] })
  @IsArray()
  @ArrayMaxSize(MAX_DRAFT_TAGS)
  @IsString({ each: true })
  @MaxLength(MAX_DRAFT_TAG_LENGTH, { each: true })
  tags!: string[];

  @ApiProperty({ enum: ['plain', 'markdown'], example: 'plain' })
  @IsIn(['plain', 'markdown'])
  format!: 'plain' | 'markdown';

  @ApiProperty({ type: Number, nullable: true, minimum: MIN_MOOD, maximum: MAX_MOOD, example: 4 })
  @ValidateIf(nullable)
  @StrictInt()
  @Min(MIN_MOOD)
  @Max(MAX_MOOD)
  mood!: number | null;

  @ApiProperty({ type: [String], maxItems: MAX_FEELINGS, example: ['calm'] })
  @IsArray()
  @ArrayMaxSize(MAX_FEELINGS)
  @IsString({ each: true })
  @MaxLength(MAX_FEELING_LENGTH, { each: true })
  feelings!: string[];
}

export class SaveComposerDraftDto extends ComposerDraftFieldsDto {
  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 1,
    example: 3,
    description:
      'The revision this save is written on top of, as the device last saved or loaded it; null when the device ' +
      'knows of no draft. Any other revision than the stored one (or null while one is stored, or a number when ' +
      'none is) is refused with COMPOSER_DRAFT_CONFLICT, so a device behind cannot overwrite newer text.',
  })
  @ValidateIf(nullable)
  @StrictInt()
  @Min(1)
  baseRevision!: number | null;
}

export class DiscardComposerDraftQueryDto {
  @ApiProperty({
    required: false,
    minimum: 1,
    example: 3,
    description:
      'Only discard the draft if it is still at this revision; a newer one, saved on another device, is kept ' +
      'and refused with COMPOSER_DRAFT_CONFLICT. Left out, the draft is discarded whatever its revision.',
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  revision?: number;
}

export class ComposerDraftResponseDto extends ComposerDraftFieldsDto {
  @ApiProperty({ example: 4, minimum: 1, description: 'Grows by one with every save' })
  revision!: number;

  @ApiProperty({ example: '2026-11-15T09:30:00.000Z', description: 'When it was last saved, from any device' })
  updatedAt!: Date;
}

export class ComposerDraftEnvelopeDto {
  @ApiProperty({ type: ComposerDraftResponseDto, nullable: true, description: 'Null when the writer has no draft' })
  draft!: ComposerDraftResponseDto | null;
}

export class ComposerDraftDiscardResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}
