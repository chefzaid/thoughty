import { Injectable } from '@nestjs/common';
import { sanitizeString } from '@/common/utils';
import { AiService } from '@/modules/ai';
import { ConfigService } from '@/modules/config';

@Injectable()
export class EntryTaggingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
  ) {}

  async resolveSavedTags(userId: number, text: string, rawTags: string[]): Promise<string[]> {
    const sanitizedTags = [...new Set(rawTags
      .map((tag: string) => sanitizeString(tag.trim()).substring(0, 50))
      .filter(Boolean))];

    const config = await this.configService.getConfig(userId);
    const autoTagMaxTags = Number.parseInt(String(config.autoTagMaxTags || '0'), 10);

    if (!Number.isFinite(autoTagMaxTags) || autoTagMaxTags <= 0 || sanitizedTags.length >= autoTagMaxTags) {
      return sanitizedTags;
    }

    const suggestedTags = await this.aiService.autoTagEntry(
      userId,
      text,
      sanitizedTags,
      autoTagMaxTags - sanitizedTags.length,
    );

    return [...sanitizedTags, ...suggestedTags];
  }
}