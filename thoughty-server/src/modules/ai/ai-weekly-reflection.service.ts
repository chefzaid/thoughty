import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@/modules/config';
import { AiUsageService } from './ai-usage.service';
import { completeOpenRouterChat } from './openrouter-chat';
import {
  buildWeeklyReflectionPrompt,
  parseWeeklyReflection,
  WEEKLY_REFLECTION_INSTRUCTIONS,
  type WeeklyReflectionEntry,
  type WeeklyReflectionReading,
} from './weekly-reflection';

/** Reads seven days of entries for their recurring themes, a short summary and one question for the week ahead. */
@Injectable()
export class AiWeeklyReflectionService {
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly usageService?: AiUsageService,
  ) {}

  /** Null when there is nothing to read, AI is not available to the writer, or the answer cannot be used. */
  async reflect(
    userId: number,
    week: { from: string; to: string },
    entries: WeeklyReflectionEntry[],
  ): Promise<WeeklyReflectionReading | null> {
    if (entries.length === 0) {
      return null;
    }

    const rawContent = await completeOpenRouterChat({ configService: this.configService, usageService: this.usageService }, userId, {
      defaultModel: this.defaultModel,
      modelSetting: 'openRouterSummaryModel',
      temperature: 0.4,
      system: WEEKLY_REFLECTION_INSTRUCTIONS,
      user: buildWeeklyReflectionPrompt(week, entries),
    });
    return rawContent ? parseWeeklyReflection(rawContent) : null;
  }
}
