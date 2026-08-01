import { BadGatewayException } from '@nestjs/common';
import type { OpenRouterUsageReporter } from './ai-usage.service';

interface EmbeddingResponseItem {
  index?: number;
  embedding?: unknown;
}

interface EmbeddingResponse {
  data?: EmbeddingResponseItem[];
}

export interface SemanticMatch {
  entryId: number;
  score: number;
}

const MAX_VECTOR_DIMENSIONS = 8192;

export function parseEmbeddingResponse(
  response: EmbeddingResponse,
  expectedCount: number,
): number[][] {
  if (!Array.isArray(response.data) || response.data.length !== expectedCount) {
    throw new BadGatewayException('OpenRouter returned an incomplete embedding response');
  }

  const vectors: Array<number[] | undefined> = Array.from({ length: expectedCount });
  let dimensions = 0;

  for (const item of response.data) {
    if (!Number.isInteger(item.index) || item.index! < 0 || item.index! >= expectedCount) {
      throw new BadGatewayException('OpenRouter returned an invalid embedding index');
    }
    if (
      !Array.isArray(item.embedding) ||
      item.embedding.length === 0 ||
      item.embedding.length > MAX_VECTOR_DIMENSIONS ||
      item.embedding.some((value) => typeof value !== 'number' || !Number.isFinite(value))
    ) {
      throw new BadGatewayException('OpenRouter returned an invalid embedding vector');
    }
    if (dimensions !== 0 && item.embedding.length !== dimensions) {
      throw new BadGatewayException('OpenRouter returned inconsistent embedding dimensions');
    }
    if (vectors[item.index!] !== undefined) {
      throw new BadGatewayException('OpenRouter returned duplicate embedding indexes');
    }

    dimensions = item.embedding.length;
    vectors[item.index!] = item.embedding as number[];
  }

  if (vectors.some((vector) => vector === undefined)) {
    throw new BadGatewayException('OpenRouter returned an incomplete embedding response');
  }
  return vectors as number[][];
}

export function cosineSimilarity(left: number[], right: number[]): number {
  let dotProduct = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let index = 0; index < left.length; index++) {
    dotProduct += left[index]! * right[index]!;
    leftMagnitude += left[index]! ** 2;
    rightMagnitude += right[index]! ** 2;
  }

  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function rankSemanticMatches(
  queryVector: number[],
  entries: Array<{ id: number; vector: number[] }>,
  limit: number,
): SemanticMatch[] {
  return entries
    .map((entry) => ({
      entryId: entry.id,
      score: Math.round(cosineSimilarity(queryVector, entry.vector) * 10_000) / 10_000,
    }))
    .sort((left, right) => right.score - left.score || left.entryId - right.entryId)
    .slice(0, limit);
}

export async function requestEmbeddings({
  apiKey,
  model,
  input,
  onUsage,
}: {
  apiKey: string;
  model: string;
  input: string[];
  onUsage?: OpenRouterUsageReporter;
}): Promise<number[][]> {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-Title': 'Thoughty',
    },
    body: JSON.stringify({ model, input }),
  });

  if (!response.ok) {
    throw new BadGatewayException('OpenRouter embedding request failed');
  }

  const data = (await response.json()) as EmbeddingResponse;
  await onUsage?.(data, model);
  return parseEmbeddingResponse(data, input.length);
}
