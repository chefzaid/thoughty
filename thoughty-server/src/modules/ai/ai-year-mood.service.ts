import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@/modules/config';
import { resolveAiModel } from './ai-model.util';
import { AiUsageService } from './ai-usage.service';
import { resolveOpenRouterCredential } from './openrouter-credential.util';
import {
  buildYearMoodPrompt,
  parseYearMood,
  YEAR_MOOD_INSTRUCTIONS,
  type YearMoodReading,
  type YearMoodSample,
} from './year-mood-analysis';

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/** Reads the mood of each month of a year from a sample of its entries. */
@Injectable()
export class AiYearMoodService {
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';
  private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly usageService?: AiUsageService,
  ) {}

  /** Null when AI is not available to the writer or the answer cannot be used. */
  async read(userId: number, samples: YearMoodSample[]): Promise<YearMoodReading | null> {
    if (samples.length === 0) {
      return null;
    }

    try {
      const credential = await resolveOpenRouterCredential(this.configService, userId);
      if (!credential) return null;
      const model = await resolveAiModel(this.configService, userId, this.defaultModel, 'openRouterToneModel');
      const response = await fetch(this.openRouterUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credential.apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Thoughty',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: YEAR_MOOD_INSTRUCTIONS },
            { role: 'user', content: buildYearMoodPrompt(samples) },
          ],
        }),
      });
      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OpenRouterResponse;
      await this.usageService?.recordResponse(userId, credential.source, model, data);
      const rawContent = data.choices?.[0]?.message?.content?.trim();
      return rawContent ? parseYearMood(rawContent, samples.map((sample) => sample.month)) : null;
    } catch {
      return null;
    }
  }
}
