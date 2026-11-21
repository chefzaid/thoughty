import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@/modules/config';
import { AiUsageService } from './ai-usage.service';
import { completeOpenRouterChat } from './openrouter-chat';
import {
  buildYearMoodPrompt,
  parseYearMood,
  YEAR_MOOD_INSTRUCTIONS,
  type YearMoodReading,
  type YearMoodSample,
} from './year-mood-analysis';

/** Reads the mood of each month of a year from a sample of its entries. */
@Injectable()
export class AiYearMoodService {
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly usageService?: AiUsageService,
  ) {}

  /** Null when AI is not available to the writer or the answer cannot be used. */
  async read(userId: number, samples: YearMoodSample[]): Promise<YearMoodReading | null> {
    if (samples.length === 0) {
      return null;
    }

    const rawContent = await completeOpenRouterChat({ configService: this.configService, usageService: this.usageService }, userId, {
      defaultModel: this.defaultModel,
      modelSetting: 'openRouterToneModel',
      temperature: 0.2,
      system: YEAR_MOOD_INSTRUCTIONS,
      user: buildYearMoodPrompt(samples),
    });
    return rawContent ? parseYearMood(rawContent, samples.map((sample) => sample.month)) : null;
  }
}
