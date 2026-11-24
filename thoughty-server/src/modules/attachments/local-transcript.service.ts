import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { AttachmentsService } from './attachments.service';
import { isTranscribableAudio } from './audio-transcription.service';
import type { AudioTranscriptionResponseDto } from './dto';

/**
 * The transcript of a recording in a diary on the writer's own model. The writer's browser sends the recording to
 * that model and only its text here, kept where Thoughty's own transcripts are (`attachments.transcript`); no
 * provider is called and the server never reaches the writer's model. Any other recording is refused, so this never
 * stands in for a transcript Thoughty's provider would make, nor for one a diary with AI off keeps out.
 */
@Injectable()
export class LocalTranscriptService {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  async store(userId: number, attachmentId: number, transcript: string): Promise<AudioTranscriptionResponseDto> {
    const attachment = await this.attachmentsService.getOwnedAttachment(userId, attachmentId);
    if (!isTranscribableAudio(attachment.mimetype)) {
      throw apiError(BadRequestException, 'ATTACHMENT_NOT_AUDIO');
    }
    if (attachment.entry?.diaryAiLocal !== true) {
      throw apiError(ForbiddenException, 'TRANSCRIPT_LOCAL_DIARY_ONLY');
    }

    attachment.transcript = transcript;
    attachment.transcribedAt = new Date();
    await this.attachmentsService.save(attachment);

    return { transcript, transcribed_at: attachment.transcribedAt, cached: false };
  }
}
