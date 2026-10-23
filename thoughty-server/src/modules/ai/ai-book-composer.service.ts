import { BadGatewayException, BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@/modules/config';
import { AiUsageService } from './ai-usage.service';
import {
  resolveOpenRouterCredential,
  type ResolvedOpenRouterCredential,
} from './openrouter-credential.util';
import { UNTRUSTED_CONTENT_INSTRUCTION, untrustedBlock } from './untrusted-content';

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export type BookWeavingMode = 'strict' | 'creative';
export interface BookChapterFraming {
  introduction: string;
  summary: string;
}

const MODE_INSTRUCTIONS: Record<BookWeavingMode, { temperature: number; instruction: string }> = {
  strict: {
    temperature: 0.4,
    instruction:
      'Stay strictly on script: never invent events, facts, opinions, or details that are not in the entries, and do not drop substantive ideas.',
  },
  creative: {
    temperature: 0.65,
    instruction:
      'Use the entries as the factual base, but you may add light connective narration, sensory texture, and reflective transitions that make the chapter more engaging. Never contradict the entries or invent major events, people, places, or conclusions.',
  },
};

@Injectable()
export class AiBookComposerService {
  private static readonly CHAPTER_INPUT_BUDGET = 20000;
  private static readonly FRAMING_INPUT_BUDGET = 20000;

  private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';
  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly usageService?: AiUsageService,
  ) {}

  isConfigured(): boolean;
  isConfigured(userId: number): Promise<boolean>;
  isConfigured(userId?: number): boolean | Promise<boolean> {
    if (userId === undefined) return Boolean(process.env.OPENROUTER_API_KEY?.trim());
    return resolveOpenRouterCredential(this.configService, userId).then(Boolean);
  }

  async composeBookChapter(
    userId: number,
    chapterTitle: string,
    entries: Array<{ date: string; content: string }>,
    mode: BookWeavingMode = 'strict',
  ): Promise<string> {
    const usableEntries = entries.filter((entry) => entry.content.trim());
    if (usableEntries.length === 0) {
      return '';
    }

    const model = await this.getModel(userId);
    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }
    const batches = this.batchEntriesByBudget(
      usableEntries,
      AiBookComposerService.CHAPTER_INPUT_BUDGET,
    );
    const parts: string[] = [];

    for (const batch of batches) {
      const previousEnding = parts.at(-1)?.slice(-400);
      parts.push(
        await this.requestChapterComposition(
          userId,
          credential,
          model,
          chapterTitle,
          batch,
          mode,
          previousEnding,
        ),
      );
    }

    return parts.join('\n\n');
  }

  async composeChapterFraming(
    userId: number,
    chapterTitle: string,
    entries: Array<{ date: string; content: string }>,
  ): Promise<BookChapterFraming> {
    const usableEntries = entries.filter((entry) => entry.content.trim());
    if (usableEntries.length === 0) {
      return { introduction: '', summary: '' };
    }

    const model = await this.getModel(userId);
    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }
    const title = untrustedBlock('chapter_title', chapterTitle);
    const framing = AiBookComposerService.FRAMING_INPUT_BUDGET - `${title}\n\n${untrustedBlock('journal_entries', '')}`.length;
    const source = untrustedBlock('journal_entries', this.buildFramingSource(usableEntries, framing));
    const content = await this.requestCompletion(userId, credential, model, 0.3, [
      {
        role: 'system',
        content: [
          "You are a book editor framing a chapter built from a person's journal entries.",
          'The chapter title is the <chapter_title> block and its entries are the <journal_entries> block of the user message.',
          'Write a concise introduction of 2-3 sentences that invites the reader into the chapter themes.',
          'Write a concise summary of 3-5 sentences that recaps the key ideas, changes, and conclusions.',
          'Stay strictly grounded in the supplied entries. Never invent facts, events, feelings, or conclusions.',
          'Return only a JSON object with string fields "introduction" and "summary". Do not use markdown.',
          UNTRUSTED_CONTENT_INSTRUCTION,
        ].join(' '),
      },
      { role: 'user', content: `${title}\n\n${source}` },
    ]);

    return this.parseChapterFraming(content);
  }

  private async getModel(userId: number): Promise<string> {
    const bookModel = await this.configService.getDecryptedConfig(userId, 'openRouterBookModel');
    if (bookModel) {
      return bookModel;
    }

    const model = await this.configService.getDecryptedConfig(userId, 'openRouterModel');
    return model || this.defaultModel;
  }

  private batchEntriesByBudget(
    entries: Array<{ date: string; content: string }>,
    budget: number,
  ): Array<Array<{ date: string; content: string }>> {
    const batches: Array<Array<{ date: string; content: string }>> = [];
    let current: Array<{ date: string; content: string }> = [];
    let currentSize = 0;

    for (const entry of entries) {
      const size = entry.content.length + entry.date.length + 10;
      if (current.length > 0 && currentSize + size > budget) {
        batches.push(current);
        current = [];
        currentSize = 0;
      }
      current.push(entry);
      currentSize += size;
    }

    if (current.length > 0) {
      batches.push(current);
    }

    return batches;
  }

  private buildFramingSource(entries: Array<{ date: string; content: string }>, budget: number): string {
    const source = entries.map((entry) => `[${entry.date}]\n${entry.content}`).join('\n\n---\n\n');
    if (source.length <= budget) {
      return source;
    }

    const omission = '\n\n[Middle of chapter omitted for length]\n\n';
    const excerptLength = Math.floor((budget - omission.length) / 2);
    return `${source.slice(0, excerptLength)}${omission}${source.slice(-excerptLength)}`;
  }

  private parseChapterFraming(content: string): BookChapterFraming {
    const normalized = content
      .replace(/^```(?:json)?\s*/i, '')
      .trimEnd()
      .replace(/```$/, '')
      .trim();

    try {
      const parsed = JSON.parse(normalized) as Record<string, unknown>;
      const introduction =
        typeof parsed.introduction === 'string' ? parsed.introduction.trim() : '';
      const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
      if (!introduction || !summary) {
        throw new Error('Missing chapter framing fields');
      }
      return { introduction, summary };
    } catch {
      throw new BadGatewayException('Invalid chapter framing response from OpenRouter');
    }
  }

  private async requestCompletion(
    userId: number,
    credential: ResolvedOpenRouterCredential,
    model: string,
    temperature: number,
    messages: Array<{ role: 'system' | 'user'; content: string }>,
  ): Promise<string> {
    const response = await fetch(this.openRouterUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Thoughty',
      },
      body: JSON.stringify({
        model,
        temperature,
        messages,
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException('OpenRouter request failed');
    }

    const data = (await response.json()) as OpenRouterResponse;
    await this.usageService?.recordResponse(userId, credential.source, model, data);
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new BadGatewayException('No response received from OpenRouter');
    }
    return content;
  }

  private async requestChapterComposition(
    userId: number,
    credential: ResolvedOpenRouterCredential,
    model: string,
    chapterTitle: string,
    entries: Array<{ date: string; content: string }>,
    mode: BookWeavingMode,
    previousEnding?: string,
  ): Promise<string> {
    const entriesText = untrustedBlock(
      'journal_entries',
      entries.map((entry) => `[${entry.date}]\n${entry.content}`).join('\n\n---\n\n'),
    );
    const title = untrustedBlock('chapter_title', chapterTitle);

    const userContent = previousEnding
      ? [
          title,
          '',
          'Continue the same chapter seamlessly. It must flow on from the previous ending in the <previous_ending> block (do not repeat it):',
          untrustedBlock('previous_ending', `...${previousEnding}`),
          '',
          'Next entries to weave in:',
          entriesText,
        ].join('\n')
      : `${title}\n\n${entriesText}`;

    const modeInstruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.strict;
    return this.requestCompletion(userId, credential, model, modeInstruction.temperature, [
      {
        role: 'system',
        content: [
          "You are a book editor turning a person's dated journal entries into a chapter of their book.",
          'The entries share the theme in the <chapter_title> block and are the <journal_entries> block of the user message.',
          'Weave them into flowing, readable prose: connect related thoughts, smooth the grammar, and order ideas naturally.',
          modeInstruction.instruction,
          "Write in the author's first-person voice and keep their tone.",
          'Return only the chapter text as plain paragraphs separated by blank lines, with no markdown, headings, bullet points, titles, or commentary.',
          UNTRUSTED_CONTENT_INSTRUCTION,
        ].join(' '),
      },
      {
        role: 'user',
        content: userContent,
      },
    ]);
  }
}
