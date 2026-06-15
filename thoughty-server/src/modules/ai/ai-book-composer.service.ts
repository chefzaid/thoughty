import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@/modules/config';

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export type BookWeavingMode = 'strict' | 'creative';

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

  private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';
  private readonly apiKey = process.env.OPENROUTER_API_KEY || '';

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async composeBookChapter(
    userId: number,
    chapterTitle: string,
    entries: Array<{ date: string; content: string }>,
    mode: BookWeavingMode = 'strict',
  ): Promise<string> {
    if (!this.apiKey) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const usableEntries = entries.filter((entry) => entry.content.trim());
    if (usableEntries.length === 0) {
      return '';
    }

    const model = await this.getModel(userId);
    const batches = this.batchEntriesByBudget(usableEntries, AiBookComposerService.CHAPTER_INPUT_BUDGET);
    const parts: string[] = [];

    for (const batch of batches) {
      const previousEnding = parts.at(-1)?.slice(-400);
      parts.push(await this.requestChapterComposition(model, chapterTitle, batch, mode, previousEnding));
    }

    return parts.join('\n\n');
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

  private async requestChapterComposition(
    model: string,
    chapterTitle: string,
    entries: Array<{ date: string; content: string }>,
    mode: BookWeavingMode,
    previousEnding?: string,
  ): Promise<string> {
    const entriesText = entries
      .map((entry) => `[${entry.date}]\n${entry.content}`)
      .join('\n\n---\n\n');

    const userContent = previousEnding
      ? [
          'Continue the same chapter seamlessly. It must flow on from this previous ending (do not repeat it):',
          `"...${previousEnding}"`,
          '',
          'Next entries to weave in:',
          entriesText,
        ].join('\n')
      : entriesText;

    const modeInstruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.strict;
    const response = await fetch(this.openRouterUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Thoughty',
      },
      body: JSON.stringify({
        model,
        temperature: modeInstruction.temperature,
        messages: [
          {
            role: 'system',
            content: [
              "You are a book editor turning a person's dated journal entries into a chapter of their book.",
              `The entries share the theme "${chapterTitle}".`,
              'Weave them into flowing, readable prose: connect related thoughts, smooth the grammar, and order ideas naturally.',
              modeInstruction.instruction,
              "Write in the author's first-person voice and keep their tone.",
              'Return only the chapter text as plain paragraphs separated by blank lines, with no markdown, headings, bullet points, titles, or commentary.',
            ].join(' '),
          },
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new BadGatewayException('OpenRouter request failed');
    }

    const data = (await response.json()) as OpenRouterResponse;
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new BadGatewayException('No response received from OpenRouter');
    }

    return content;
  }
}
