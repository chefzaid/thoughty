import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diary } from '@/database/entities';
import { sanitizeString } from '@/common/utils';
import { AiService } from '@/modules/ai';
import { ConfigService } from '@/modules/config';
import { FeatureFlagsService } from '@/common/feature-flags';

@Injectable()
export class EntryTaggingService {
  constructor(
    private readonly configService: ConfigService,
    private readonly aiService: AiService,
    private readonly featureFlags: FeatureFlagsService,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
  ) {}

  /** The tags an entry saves with: those given, then the AI's up to the writer's limit, unless its diary (`diaryId`) has AI off. */
  async resolveSavedTags(userId: number, text: string, rawTags: string[], diaryId?: number | null): Promise<string[]> {
    const sanitizedTags = [...new Set(rawTags
      .map((tag: string) => sanitizeString(tag.trim()).substring(0, 50))
      .filter(Boolean))];

    const config = await this.configService.getConfig(userId);
    const autoTagMaxTags = Number.parseInt(String(config.autoTagMaxTags || '0'), 10);

    if (!Number.isFinite(autoTagMaxTags) || autoTagMaxTags <= 0 || sanitizedTags.length >= autoTagMaxTags) {
      return sanitizedTags;
    }
    // With AI switched off, an entry saves with the tags it was given
    if (!(await this.featureFlags.isEnabled('ai'))) {
      return sanitizedTags;
    }
    if (diaryId && (await this.diaryRepository.exists({ where: { id: diaryId, userId, aiMode: 'off' } }))) {
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