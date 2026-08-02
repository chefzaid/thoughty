import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@/modules/config';
import { AiUsageService } from '@/modules/ai/ai-usage.service';
import { resolveOpenRouterCredential } from '@/modules/ai/openrouter-credential.util';
import { AttachmentsService } from './attachments.service';
import type { AudioTranscriptionResponseDto } from './dto';

const MAX_AUDIO_SIZE = 5 * 1024 * 1024;
const TRANSCRIPTION_MODEL =
  process.env.OPENROUTER_TRANSCRIPTION_MODEL?.trim() || 'openai/whisper-large-v3';

const AUDIO_FORMATS: Readonly<Record<string, string>> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/wave': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
};

interface OpenRouterTranscriptionResponse {
  text?: unknown;
  usage?: unknown;
}

@Injectable()
export class AudioTranscriptionService {
  constructor(
    private readonly attachmentsService: AttachmentsService,
    private readonly configService: ConfigService,
    private readonly usageService: AiUsageService,
  ) {}

  async transcribe(userId: number, attachmentId: number): Promise<AudioTranscriptionResponseDto> {
    const attachment = await this.attachmentsService.getOwnedAttachment(userId, attachmentId);
    const format = AUDIO_FORMATS[attachment.mimetype];
    if (!format) {
      throw new BadRequestException('Only audio attachments can be transcribed');
    }

    if (attachment.transcript && attachment.transcribedAt) {
      return {
        transcript: attachment.transcript,
        transcribed_at: attachment.transcribedAt,
        cached: true,
      };
    }

    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const audio = await this.attachmentsService.getFileBuffer(
      attachment.storedFilename,
      MAX_AUDIO_SIZE,
    );
    const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: TRANSCRIPTION_MODEL,
        input_audio: { data: audio.toString('base64'), format },
      }),
      signal: AbortSignal.timeout(60_000),
    }).catch(() => {
      throw new BadGatewayException('Audio transcription provider is unavailable');
    });

    if (!response.ok) {
      throw new BadGatewayException('Audio transcription request failed');
    }

    const payload = (await response.json().catch(() => {
      throw new BadGatewayException('Audio transcription returned an invalid response');
    })) as OpenRouterTranscriptionResponse;
    const transcript = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (!transcript) {
      throw new BadGatewayException('Audio transcription returned no text');
    }

    await this.usageService.recordResponse(userId, credential.source, TRANSCRIPTION_MODEL, payload);

    attachment.transcript = transcript;
    attachment.transcribedAt = new Date();
    await this.attachmentsService.save(attachment);

    return {
      transcript,
      transcribed_at: attachment.transcribedAt,
      cached: false,
    };
  }
}
