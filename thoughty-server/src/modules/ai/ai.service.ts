import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@/modules/config';
import { SuggestTagsDto } from './dto/suggest-tags.dto';
import { FixWritingDto } from './dto/fix-writing.dto';
import { ChatDto } from './dto/chat.dto';

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

@Injectable()
export class AiService {
  private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';
  private readonly apiKey = process.env.OPENROUTER_API_KEY || '';

  constructor(private readonly configService: ConfigService) {}

  private async getModel(userId: number): Promise<string> {
    const model = await this.configService.getDecryptedConfig(userId, 'openRouterModel');
    return model || this.defaultModel;
  }

  async suggestTags(userId: number, dto: SuggestTagsDto): Promise<{ tags: string[] }> {
    if (!dto.content.trim()) {
      throw new BadRequestException('Content is required for tag suggestions');
    }

    if (!this.apiKey) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const maxTags = Math.min(Math.max(dto.maxTags ?? 5, 1), 10);
    const existingTags = dto.existingTags?.filter(Boolean) ?? [];

    const model = await this.getModel(userId);

    return {
      tags: await this.requestTags(dto.content, existingTags, maxTags, model),
    };
  }

  async autoTagEntry(
    userId: number,
    content: string,
    existingTags: string[] = [],
    maxTags = 5,
  ): Promise<string[]> {
    if (!content.trim() || maxTags <= 0) {
      return [];
    }

    if (!this.apiKey) {
      return [];
    }

    try {
      const model = await this.getModel(userId);
      return await this.requestTags(content, existingTags, Math.min(Math.max(maxTags, 1), 10), model);
    } catch {
      return [];
    }
  }

  private async requestTags(
    content: string,
    existingTags: string[],
    maxTags: number,
    model: string,
  ): Promise<string[]> {

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
            content:
              'You suggest concise journal tags. Return only a JSON array of lowercase tag strings. Do not include explanations, numbering, or markdown.',
          },
          {
            role: 'user',
            content: [
              `Suggest up to ${maxTags} tags for this journal entry.`,
              existingTags.length > 0 ? `Existing tags already chosen: ${existingTags.join(', ')}.` : 'There are no existing tags yet.',
              'Avoid duplicates, keep tags short, and prefer reusable concepts.',
              `Entry:\n${content}`,
            ].join('\n\n'),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException('OpenRouter request failed');
    }

    const data = (await response.json()) as OpenRouterResponse;
    const rawContent = data.choices?.[0]?.message?.content ?? '[]';
    const parsed = this.parseTags(rawContent);

    return parsed
      .filter((tag) => !existingTags.some((existing) => existing.toLowerCase() === tag))
      .slice(0, maxTags);
  }

  async fixWriting(userId: number, dto: FixWritingDto): Promise<{ content: string }> {
    if (!dto.content.trim()) {
      throw new BadRequestException('Content is required for writing fixes');
    }

    if (!this.apiKey) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const model = await this.getModel(userId);

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
            content:
              'You are a proofreader. Fix grammar, spelling, and punctuation errors in the text. Improve awkward phrasing while preserving the original meaning, tone, and voice. Return only the corrected text with no explanations, comments, or markdown formatting.',
          },
          {
            role: 'user',
            content: dto.content,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException('OpenRouter request failed');
    }

    const data = (await response.json()) as OpenRouterResponse;
    const corrected = data.choices?.[0]?.message?.content?.trim();

    return { content: corrected || dto.content };
  }

  async chat(userId: number, dto: ChatDto): Promise<{ reply: string }> {
    if (!dto.entryContent.trim()) {
      throw new BadRequestException('Entry content is required');
    }

    if (dto.messages.length === 0) {
      throw new BadRequestException('At least one message is required');
    }

    if (!this.apiKey) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const model = await this.getModel(userId);

    const response = await fetch(this.openRouterUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Thoughty',
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        messages: [
          {
            role: 'system',
            content: [
              'You are a thoughtful journal companion. The user wants to discuss or analyze their journal entry.',
              'Be empathetic, insightful, and encouraging. Offer observations about themes, emotions, and patterns.',
              'Ask follow-up questions to help the user reflect deeper when appropriate.',
              'Keep responses concise but meaningful. Do not use markdown formatting.',
              '',
              'Journal entry being discussed:',
              dto.entryContent,
            ].join('\n'),
          },
          ...dto.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException('OpenRouter request failed');
    }

    const data = (await response.json()) as OpenRouterResponse;
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new BadGatewayException('No response received from OpenRouter');
    }

    return { reply };
  }

  async listModels(): Promise<{ id: string; name: string }[]> {
    if (!this.apiKey) {
      throw new BadRequestException('OpenRouter API key is not configured on the server');
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'X-Title': 'Thoughty',
      },
    });

    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch models from OpenRouter');
    }

    const data = (await response.json()) as { data?: Array<{ id?: string; name?: string }> };
    const models = data.data ?? [];

    return models
      .filter((m): m is { id: string; name: string } => typeof m.id === 'string' && typeof m.name === 'string')
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private parseTags(rawContent: string): string[] {
    const trimmed = rawContent.trim();
    const arrayMatch = /\[[\s\S]*\]/.exec(trimmed);
    const arrayCandidate = trimmed.startsWith('[')
      ? trimmed
      : (arrayMatch?.[0] ?? '[]');

    try {
      const parsed = JSON.parse(arrayCandidate) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }

      return [...new Set(parsed
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().replace(/^#+/, '').toLowerCase().replaceAll(/\s+/g, '-'))
        .filter(Boolean))];
    } catch {
      return [];
    }
  }
}