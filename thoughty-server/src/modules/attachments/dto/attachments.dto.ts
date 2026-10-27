import { IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Attachment } from '@/database/entities';
import { AttachmentResponseDto } from '@/modules/entries/dto';
import { StrictInt } from '@/common/validation';

export class LinkAttachmentDto {
  @ApiPropertyOptional({ description: 'Entry ID to link attachment to' })
  @IsOptional()
  @StrictInt()
  entryId?: number;
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
    entry_id: attachment.entryId,
    created_at: attachment.createdAt,
    transcript: attachment.transcript,
    transcribed_at: attachment.transcribedAt,
  };
}
