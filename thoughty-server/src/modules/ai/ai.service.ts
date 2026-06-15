import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiChatHistory, Entry } from '@/database/entities';
import { ConfigService } from '@/modules/config';
import { SuggestTagsDto } from './dto/suggest-tags.dto';
import { FixWritingDto, type FixWritingMode } from './dto/fix-writing.dto';
import { ChatDto, ChatHistoryResponseDto, ChatMessageDto } from './dto/chat.dto';

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export interface ToneMoodAnalysis {
  dominantMood: string;
  dominantTone: string;
  moodBreakdown: Record<string, number>;
  toneBreakdown: Record<string, number>;
  analyzedEntries: number;
  summary: string;
}

type AiModelTask = 'tag' | 'writing' | 'chat' | 'tone';

const TASK_MODEL_CONFIG_KEYS: Record<AiModelTask, string> = {
  tag: 'openRouterTagModel',
  writing: 'openRouterWritingModel',
  chat: 'openRouterChatModel',
  tone: 'openRouterToneModel',
};

@Injectable()
export class AiService {
  private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';
  private readonly apiKey = process.env.OPENROUTER_API_KEY || '';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(AiChatHistory)
    private readonly chatHistoryRepository: Repository<AiChatHistory>,
  ) {}

  private async assertEntryOwnership(userId: number, entryId: number): Promise<void> {
    const entry = await this.entryRepository.findOne({ where: { id: entryId, userId } });

    if (!entry) {
      throw new NotFoundException('Entry not found');
    }
  }

  async getChatHistory(userId: number, entryId: number): Promise<ChatHistoryResponseDto> {
    await this.assertEntryOwnership(userId, entryId);

    const history = await this.chatHistoryRepository.findOne({ where: { userId, entryId } });

    return {
      entryId,
      messages: history?.messages ?? [],
    };
  }

  private async saveChatHistory(userId: number, entryId: number, messages: ChatMessageDto[]): Promise<void> {
    const existingHistory = await this.chatHistoryRepository.findOne({ where: { userId, entryId } });

    await this.chatHistoryRepository.save({
      ...existingHistory,
      userId,
      entryId,
      messages,
    });
  }

  private async getModel(userId: number, task?: AiModelTask): Promise<string> {
    if (task) {
      const taskModel = await this.configService.getDecryptedConfig(userId, TASK_MODEL_CONFIG_KEYS[task]);
      if (taskModel) {
        return taskModel;
      }
    }

    const model = await this.configService.getDecryptedConfig(userId, 'openRouterModel');
    return model || this.defaultModel;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  private getFixWritingInstruction(mode: FixWritingMode | undefined): string {
    switch (mode) {
      case 'polish':
        return 'You are an editor. Correct grammar, spelling, punctuation, and awkward phrasing. Apply only light style improvements so the writing reads more smoothly while preserving the original meaning, tone, voice, and structure as much as possible. Return only the revised text with no explanations, comments, or markdown formatting.';
      case 'rewrite':
        return 'You are a ghostwriter. Rewrite the text completely for clarity, flow, and readability while preserving the original meaning and core details. You may substantially restructure sentences and phrasing, but keep the same intent and avoid adding new facts. Return only the rewritten text with no explanations, comments, or markdown formatting.';
      case 'grammar':
      default:
        return 'You are a proofreader. Fix grammar, spelling, punctuation, and formatting issues only. Keep the wording, structure, tone, and voice as close to the original as possible unless a change is required for correctness. Return only the corrected text with no explanations, comments, or markdown formatting.';
    }
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

    const model = await this.getModel(userId, 'tag');

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
      const model = await this.getModel(userId, 'tag');
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

    const model = await this.getModel(userId, 'writing');

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
            content: this.getFixWritingInstruction(dto.mode),
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
    await this.assertEntryOwnership(userId, dto.entryId);

    if (!dto.entryContent.trim()) {
      throw new BadRequestException('Entry content is required');
    }

    if (dto.messages.length === 0) {
      throw new BadRequestException('At least one message is required');
    }

    if (!this.apiKey) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const model = await this.getModel(userId, 'chat');

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

    await this.saveChatHistory(userId, dto.entryId, [...dto.messages, { role: 'assistant', content: reply }]);

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

  async analyzeToneMood(
    userId: number,
    entries: Array<Pick<Entry, 'id' | 'content' | 'date' | 'tags'>>,
  ): Promise<ToneMoodAnalysis | null> {
    const preparedEntries = entries
      .filter((entry) => typeof entry.content === 'string' && entry.content.trim().length > 0)
      .slice(0, 40);

    if (preparedEntries.length === 0 || !this.apiKey) {
      return null;
    }

    try {
      const model = await this.getModel(userId, 'tone');
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
                'You analyze a batch of journal entries and summarize their mood and writing tone.',
                'Return only JSON with the keys dominantMood, dominantTone, moodBreakdown, toneBreakdown, and summary.',
                'moodBreakdown and toneBreakdown must be JSON objects whose values are integer counts.',
                'Use concise lowercase labels for moods and tones.',
                'The counts should reflect the entries provided, and summary should be one short sentence with no markdown.',
              ].join(' '),
            },
            {
              role: 'user',
              content: preparedEntries.map((entry) => [
                `Entry ${entry.id}`,
                `Date: ${entry.date}`,
                entry.tags.length > 0 ? `Tags: ${entry.tags.join(', ')}` : 'Tags: none',
                `Content: ${entry.content.slice(0, 1200)}`,
              ].join('\n')).join('\n\n---\n\n'),
            },
          ],
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OpenRouterResponse;
      const rawContent = data.choices?.[0]?.message?.content?.trim();

      if (!rawContent) {
        return null;
      }

      return this.parseToneMoodAnalysis(rawContent, preparedEntries.length);
    } catch {
      return null;
    }
  }

  private parseToneMoodAnalysis(rawContent: string, analyzedEntries: number): ToneMoodAnalysis | null {
    const trimmed = rawContent.trim();
    const objectMatch = /\{[\s\S]*\}/.exec(trimmed);
    const objectCandidate = trimmed.startsWith('{')
      ? trimmed
      : (objectMatch?.[0] ?? '{}');

    try {
      const parsed = JSON.parse(objectCandidate) as Record<string, unknown>;
      const moodBreakdown = this.parseAnalysisBreakdown(parsed.moodBreakdown);
      const toneBreakdown = this.parseAnalysisBreakdown(parsed.toneBreakdown);
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
      const dominantMood = this.parseAnalysisLabel(parsed.dominantMood) ?? this.getDominantAnalysisLabel(moodBreakdown);
      const dominantTone = this.parseAnalysisLabel(parsed.dominantTone) ?? this.getDominantAnalysisLabel(toneBreakdown);

      if (!dominantMood || !dominantTone || (!summary && Object.keys(moodBreakdown).length === 0 && Object.keys(toneBreakdown).length === 0)) {
        return null;
      }

      return {
        dominantMood,
        dominantTone,
        moodBreakdown,
        toneBreakdown,
        analyzedEntries,
        summary: summary || 'Recent entries show a mixed emotional and tonal profile.',
      };
    } catch {
      return null;
    }
  }

  private parseAnalysisBreakdown(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    const breakdownEntries = Object.entries(value)
      .map(([label, count]) => {
        const parsedLabel = this.parseAnalysisLabel(label);
        const parsedCount = typeof count === 'number'
          ? Math.round(count)
          : Number.parseInt(String(count), 10);

        if (!parsedLabel || !Number.isFinite(parsedCount) || parsedCount <= 0) {
          return null;
        }

        return [parsedLabel, parsedCount] as const;
      })
      .filter((entry): entry is readonly [string, number] => entry !== null)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 6);

    return Object.fromEntries(breakdownEntries);
  }

  private parseAnalysisLabel(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toLowerCase().replaceAll(/\s+/g, ' ');
    return normalized.length > 0 ? normalized : null;
  }

  private getDominantAnalysisLabel(breakdown: Record<string, number>): string | null {
    const [first] = Object.entries(breakdown).sort(([, left], [, right]) => right - left);
    return first?.[0] ?? null;
  }
}
