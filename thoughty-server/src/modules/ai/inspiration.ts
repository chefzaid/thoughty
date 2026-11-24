import { BadGatewayException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import type { OpenRouterUsageReporter } from './ai-usage.service';
import { INSPIRATION_INSTRUCTION } from './prompt-instructions';

export interface InspirationTheme {
  tag: string;
  count: number;
}

interface RequestInspirationOptions {
  apiKey: string;
  model: string;
  themes: InspirationTheme[];
  recentThemes: string[];
  onUsage?: OpenRouterUsageReporter;
}

interface OpenRouterInspirationResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

/** How many entries, newest first, Get Inspired reads the tags of, and how many themes it sends of them. */
export const INSPIRATION_LIMITS = { taggedEntries: 200, themes: 20, recentEntries: 12, recentThemes: 15, questionLength: 400 } as const;

export const INSPIRATION_ENTRY_WINDOW = INSPIRATION_LIMITS.taggedEntries;

/**
 * Summarizes tags from entries ordered newest first into overall frequency
 * and the themes of the most recent entries.
 */
export function summarizeThemes(entryTags: string[][]): {
  themes: InspirationTheme[];
  recentThemes: string[];
} {
  const counts = new Map<string, number>();
  for (const tags of entryTags.slice(0, INSPIRATION_LIMITS.taggedEntries)) {
    for (const tag of new Set(tags.map((value) => value.trim()).filter(Boolean))) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  const themes = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, INSPIRATION_LIMITS.themes);
  const recentThemes = [
    ...new Set(
      entryTags
        .slice(0, INSPIRATION_LIMITS.recentEntries)
        .flat()
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ].slice(0, INSPIRATION_LIMITS.recentThemes);

  return { themes, recentThemes };
}

function parseQuestion(rawContent: string): string {
  return rawContent
    .trim()
    .replace(/^```\w*\s*|\s*```$/g, '')
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .trim()
    .slice(0, INSPIRATION_LIMITS.questionLength);
}

export async function requestInspiration({
  apiKey,
  model,
  themes,
  recentThemes,
  onUsage,
}: RequestInspirationOptions): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Thoughty',
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      messages: [
        {
          role: 'system',
          content: INSPIRATION_INSTRUCTION,
        },
        {
          role: 'user',
          content: JSON.stringify({ themes, recentThemes }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw apiError(BadGatewayException, 'AI_PROVIDER_FAILED');
  }

  const data = (await response.json()) as OpenRouterInspirationResponse;
  await onUsage?.(data, model);
  const question = parseQuestion(data.choices?.[0]?.message?.content ?? '');

  if (!question) {
    throw apiError(BadGatewayException, 'AI_PROVIDER_FAILED', 'No question received from OpenRouter');
  }

  return question;
}
