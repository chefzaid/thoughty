import { IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Attachment } from '@/database/entities';
import { AttachmentResponseDto } from '@/modules/entries/dto';
import { StrictInt } from '@/common/validation';
import { AiConsentProperty } from '@/common/diary-ai';
import { API_ERROR_MESSAGES } from '@/common/errors';

/** The longest transcript the browser may send for a recording (5 MB of speech is well under it). */
export const TRANSCRIPT_MAX_LENGTH = 50_000;

export class LinkAttachmentDto {
  @ApiPropertyOptional({ description: 'Entry ID to link attachment to' })
  @IsOptional()
  @StrictInt()
  entryId?: number;
}

export class TranscribeAttachmentDto {
  @ApiPropertyOptional({
    description:
      'Diary the recording is for, while it belongs to no entry yet (a memoir answer being written); a diary with ' +
      'AI off refuses the request (`403 DIARY_AI_OFF`), one on the writer’s own model refuses it too ' +
      '(`403 DIARY_AI_LOCAL`), and one that asks before each AI request refuses it without `aiConsent` ' +
      '(`403 DIARY_AI_CONSENT_REQUIRED`)',
    minimum: 1,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  diaryId?: number;

  @AiConsentProperty()
  aiConsent?: boolean;
}

/** A transcript made on the writer's device by the browser, for a recording in a diary set to "My own model only". */
export class StoreTranscriptDto {
  @ApiProperty({
    description:
      `The recording's text, trimmed; at most ${TRANSCRIPT_MAX_LENGTH} characters (a longer one is refused with ` +
      '`400 TRANSCRIPT_TOO_LONG`)',
    minLength: 1,
    maxLength: TRANSCRIPT_MAX_LENGTH,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(TRANSCRIPT_MAX_LENGTH, {
    message: API_ERROR_MESSAGES.TRANSCRIPT_TOO_LONG,
    context: { code: 'TRANSCRIPT_TOO_LONG' },
  })
  transcript: string;
}

export class AudioTranscriptionResponseDto {
  @ApiProperty({ description: 'Transcribed audio text' })
  transcript: string;

  @ApiProperty({ description: 'When the transcript was generated' })
  transcribed_at: Date;

  @ApiProperty({
    description: 'Whether the stored transcript was returned without a provider call',
  })
  cached: boolean;
}

/** An attachment as its upload or link answers it: the entry's attachment fields plus its entry and upload time. */
export class AttachmentRecordResponseDto extends AttachmentResponseDto {
  @ApiPropertyOptional({ type: Number, nullable: true, description: 'The entry it belongs to, or null until linked' })
  entry_id: number | null;

  @ApiProperty()
  created_at: Date;
}

export function toAttachmentRecordResponse(attachment: Attachment): AttachmentRecordResponseDto {
  return {
    id: attachment.id,
    original_filename: attachment.originalFilename,
    stored_filename: attachment.storedFilename,
    mimetype: attachment.mimetype,
    size: attachment.size,
    poster_filename: attachment.posterFilename,
    entry_id: attachment.entryId,
    created_at: attachment.createdAt,
    transcript: attachment.transcript,
    transcribed_at: attachment.transcribedAt,
  };
}
