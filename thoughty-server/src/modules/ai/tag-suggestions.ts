import { extractJsonCandidate } from '@/common/utils/json-content.util';
import { BadGatewayException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import type { OpenRouterUsageReporter } from './ai-usage.service';
import { TAG_SUGGESTIONS_INSTRUCTION } from './prompt-instructions';

interface RequestTagSuggestionsOptions {
  apiKey: string;
  model: string;
  content: string;
  existingTags: string[];
  maxTags: number;
  onUsage?: OpenRouterUsageReporter;
}

interface OpenRouterTagResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

function parseTags(rawContent: string): string[] {
  const candidate = extractJsonCandidate(rawContent, '[') ?? '[]';

  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return [
      ...new Set(
        parsed
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim().replace(/^#+/, '').toLowerCase().replaceAll(/\s+/g, '-'))
          .filter(Boolean),
      ),
    ];
  } catch {
    return [];
  }
}

export async function requestTagSuggestions({
  apiKey,
  model,
  content,
  existingTags,
  maxTags,
  onUsage,
}: RequestTagSuggestionsOptions): Promise<string[]> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Thoughty',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: TAG_SUGGESTIONS_INSTRUCTION,
        },
        {
          role: 'user',
          content: JSON.stringify({
            maxTags,
            existingTags,
            entry: content,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw apiError(BadGatewayException, 'AI_PROVIDER_FAILED');
  }

  const data = (await response.json()) as OpenRouterTagResponse;
  await onUsage?.(data, model);
  return parseTags(data.choices?.[0]?.message?.content ?? '[]')
    .filter((tag) => !existingTags.some((existing) => existing.toLowerCase() === tag))
    .slice(0, maxTags);
}
