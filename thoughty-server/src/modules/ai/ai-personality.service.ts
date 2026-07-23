import { Injectable } from '@nestjs/common';
import { ConfigService } from '@/modules/config';
import { resolveAiModel } from './ai-model.util';
import {
  parsePersonalityAssessment,
  type PersonalityAssessment,
  type WritingProfile,
} from './personality-analysis';

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

@Injectable()
export class AiPersonalityService {
  private readonly apiKey = process.env.OPENROUTER_API_KEY || '';
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';
  private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

  constructor(private readonly configService: ConfigService) {}

  async analyze(userId: number, profile: WritingProfile): Promise<PersonalityAssessment | null> {
    if (!this.apiKey || profile.analyzedEntries === 0) {
      return null;
    }

    try {
      const model = await resolveAiModel(
        this.configService,
        userId,
        this.defaultModel,
        'openRouterToneModel',
      );
      const response = await fetch(this.openRouterUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': 'Thoughty',
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: [
                'Analyze aggregate journal writing statistics and describe non-clinical writing tendencies.',
                'Do not diagnose mental health conditions or infer race, ethnicity, religion, sexuality, political affiliation, or other protected traits.',
                'Do not claim certainty about the writer; ground every tendency in the provided word, subject, and writing metrics.',
                'Return only JSON with a traits array and summary.',
                'Each trait must contain label, score from 0 to 100, and one concise evidence sentence.',
                'Return three to five distinct traits and write in the predominant language of the aggregate words and subjects.',
              ].join(' '),
            },
            {
              role: 'user',
              content: JSON.stringify(profile),
            },
          ],
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OpenRouterResponse;
      const rawContent = data.choices?.[0]?.message?.content?.trim();
      return rawContent ? parsePersonalityAssessment(rawContent) : null;
    } catch {
      return null;
    }
  }
}
