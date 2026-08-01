import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiChatHistory, Entry } from '@/database/entities';
import { ConfigService } from '@/modules/config';
import { SuggestTagsDto } from './dto/suggest-tags.dto';
import { FixWritingDto, type FixWritingMode } from './dto/fix-writing.dto';
import { ChatDto, ChatHistoryResponseDto, ChatMessageDto } from './dto/chat.dto';
import { SummarizeEntryDto } from './dto/summarize-entry.dto';
import { GenerateWritingPromptsDto } from './dto/writing-prompts.dto';
import { requestEntrySummary } from './entry-summary';
import { requestTagSuggestions } from './tag-suggestions';
import { parseJournalAnalysis, type JournalAnalysis } from './journal-analysis';
import { requestWritingPrompts } from './writing-prompts';
import { resolveAiModel } from './ai-model.util';
import { AiUsageService } from './ai-usage.service';
import { resolveOpenRouterCredential } from './openrouter-credential.util';

export type { JournalAnalysis, SubjectAnalysis, ToneMoodAnalysis } from './journal-analysis';

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type AiModelTask = 'tag' | 'writing' | 'chat' | 'tone' | 'summary' | 'prompt';

const TASK_MODEL_CONFIG_KEYS: Record<AiModelTask, string> = {
  tag: 'openRouterTagModel',
  writing: 'openRouterWritingModel',
  chat: 'openRouterChatModel',
  tone: 'openRouterToneModel',
  summary: 'openRouterSummaryModel',
  prompt: 'openRouterPromptModel',
};

@Injectable()
export class AiService {
  private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @InjectRepository(AiChatHistory)
    private readonly chatHistoryRepository: Repository<AiChatHistory>,
    @Optional() private readonly usageService?: AiUsageService,
  ) {}

  private async assertEntryOwnership(userId: number, entryId: number): Promise<Entry> {
    const entry = await this.entryRepository.findOne({ where: { id: entryId, userId } });
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }
    return entry;
  }

  async getChatHistory(userId: number, entryId: number): Promise<ChatHistoryResponseDto> {
    await this.assertEntryOwnership(userId, entryId);

    const history = await this.chatHistoryRepository.findOne({ where: { userId, entryId } });

    return {
      entryId,
      messages: history?.messages ?? [],
    };
  }

  private async saveChatHistory(
    userId: number,
    entryId: number,
    messages: ChatMessageDto[],
  ): Promise<void> {
    const existingHistory = await this.chatHistoryRepository.findOne({
      where: { userId, entryId },
    });

    await this.chatHistoryRepository.save({
      ...existingHistory,
      userId,
      entryId,
      messages,
    });
  }

  private async getModel(userId: number, task?: AiModelTask): Promise<string> {
    return resolveAiModel(
      this.configService,
      userId,
      this.defaultModel,
      task ? TASK_MODEL_CONFIG_KEYS[task] : undefined,
    );
  }

  isConfigured(): boolean;
  isConfigured(userId: number): Promise<boolean>;
  isConfigured(userId?: number): boolean | Promise<boolean> {
    if (userId === undefined) return Boolean(process.env.OPENROUTER_API_KEY?.trim());
    return resolveOpenRouterCredential(this.configService, userId).then(Boolean);
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

    const model = await this.getModel(userId, 'tag');
    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const maxTags = Math.min(Math.max(dto.maxTags ?? 5, 1), 10);
    const existingTags = dto.existingTags?.filter(Boolean) ?? [];

    return {
      tags: await requestTagSuggestions({
        apiKey: credential.apiKey,
        model,
        content: dto.content,
        existingTags,
        maxTags,
        style: dto.style ?? 'specific',
        onUsage: this.usageService?.reporter(userId, credential.source),
      }),
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

    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      return [];
    }

    try {
      const model = await this.getModel(userId, 'tag');
      return await requestTagSuggestions({
        apiKey: credential.apiKey,
        model,
        content,
        existingTags,
        maxTags: Math.min(Math.max(maxTags, 1), 10),
        style: 'specific',
        onUsage: this.usageService?.reporter(userId, credential.source),
      });
    } catch {
      return [];
    }
  }

  async fixWriting(userId: number, dto: FixWritingDto): Promise<{ content: string }> {
    if (!dto.content.trim()) {
      throw new BadRequestException('Content is required for writing fixes');
    }

    const model = await this.getModel(userId, 'writing');
    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }
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
    await this.usageService?.recordResponse(userId, credential.source, model, data);
    const corrected = data.choices?.[0]?.message?.content?.trim();

    return { content: corrected || dto.content };
  }

  async summarizeEntry(userId: number, dto: SummarizeEntryDto): Promise<{ summary: string }> {
    const entry = await this.assertEntryOwnership(userId, dto.entryId);
    if (!entry.content.trim()) {
      throw new BadRequestException('Entry content is required');
    }
    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const model = await this.getModel(userId, 'summary');
    const summary = await requestEntrySummary({
      ...dto,
      content: entry.content,
      apiKey: credential.apiKey,
      model,
      onUsage: this.usageService?.reporter(userId, credential.source),
    });
    return { summary };
  }

  async generateWritingPrompts(
    userId: number,
    dto: GenerateWritingPromptsDto,
  ): Promise<{ prompts: string[] }> {
    const entries = await this.entryRepository.find({
      where: dto.diaryId == null ? { userId } : { userId, diaryId: dto.diaryId },
      select: { date: true, tags: true, content: true },
      order: { date: 'DESC', index: 'DESC' },
      take: 12,
    });
    if (entries.length === 0) {
      throw new BadRequestException('Journal history is required for writing prompts');
    }
    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const model = await this.getModel(userId, 'prompt');
    const history = entries.map(({ date, tags, content }) => ({
      date,
      tags,
      content: content.slice(0, 800),
    }));
    return {
      prompts: await requestWritingPrompts({
        apiKey: credential.apiKey,
        model,
        history,
        onUsage: this.usageService?.reporter(userId, credential.source),
      }),
    };
  }

  async chat(userId: number, dto: ChatDto): Promise<{ reply: string }> {
    await this.assertEntryOwnership(userId, dto.entryId);

    if (!dto.entryContent.trim()) {
      throw new BadRequestException('Entry content is required');
    }

    if (dto.messages.length === 0) {
      throw new BadRequestException('At least one message is required');
    }

    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const model = await this.getModel(userId, 'chat');

    const response = await fetch(this.openRouterUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
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
    await this.usageService?.recordResponse(userId, credential.source, model, data);
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      throw new BadGatewayException('No response received from OpenRouter');
    }

    await this.saveChatHistory(userId, dto.entryId, [
      ...dto.messages,
      { role: 'assistant', content: reply },
    ]);

    return { reply };
  }

  async listModels(userId = 0): Promise<{ id: string; name: string }[]> {
    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        'X-Title': 'Thoughty',
      },
    });

    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch models from OpenRouter');
    }

    const data = (await response.json()) as { data?: Array<{ id?: string; name?: string }> };
    const models = data.data ?? [];

    return models
      .filter(
        (m): m is { id: string; name: string } =>
          typeof m.id === 'string' && typeof m.name === 'string',
      )
      .map(({ id, name }) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async analyzeJournal(
    userId: number,
    entries: Array<Pick<Entry, 'id' | 'content' | 'date' | 'tags'>>,
  ): Promise<JournalAnalysis | null> {
    const preparedEntries = entries
      .filter((entry) => typeof entry.content === 'string' && entry.content.trim().length > 0)
      .slice(0, 40);

    if (preparedEntries.length === 0) {
      return null;
    }

    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) return null;

    try {
      const model = await this.getModel(userId, 'tone');
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
            {
              role: 'system',
              content: [
                'You analyze a batch of journal entries and summarize their mood, writing tone, and discussed subjects.',
                'Return only JSON with the keys dominantMood, dominantTone, moodBreakdown, toneBreakdown, summary, subjectBreakdown, and subjectSummary.',
                'All breakdowns must be JSON objects whose values are integer counts of entries.',
                'Use concise lowercase labels and merge closely related subjects instead of repeating synonyms.',
                'Use the predominant language of the entries for labels and summaries.',
                'Each summary must be one short sentence with no markdown.',
              ].join(' '),
            },
            {
              role: 'user',
              content: preparedEntries
                .map((entry) =>
                  [
                    `Entry ${entry.id}`,
                    `Date: ${entry.date}`,
                    entry.tags.length > 0 ? `Tags: ${entry.tags.join(', ')}` : 'Tags: none',
                    `Content: ${entry.content.slice(0, 1200)}`,
                  ].join('\n'),
                )
                .join('\n\n---\n\n'),
            },
          ],
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OpenRouterResponse;
      await this.usageService?.recordResponse(userId, credential.source, model, data);
      const rawContent = data.choices?.[0]?.message?.content?.trim();

      if (!rawContent) {
        return null;
      }

      return parseJournalAnalysis(rawContent, preparedEntries.length);
    } catch {
      return null;
    }
  }
}
