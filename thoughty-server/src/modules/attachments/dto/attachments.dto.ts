import { IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class LinkAttachmentDto {
  @ApiPropertyOptional({ description: 'Entry ID to link attachment to' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
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
