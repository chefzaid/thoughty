import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageEvent, type AiCredentialSource } from '@/database/entities';

interface OpenRouterUsagePayload {
  prompt_tokens?: unknown;
  completion_tokens?: unknown;
  input_tokens?: unknown;
  output_tokens?: unknown;
  total_tokens?: unknown;
  cost?: unknown;
  completion_tokens_details?: { reasoning_tokens?: unknown };
}

interface UsageAggregateRow {
  promptTokens?: string;
  completionTokens?: string;
  reasoningTokens?: string;
  totalTokens?: string;
  cost?: string;
  requests?: string;
}

export interface ThoughtyAiUsage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  cost: number;
  requests: number;
  periodDays: number;
}

export type OpenRouterUsageReporter = (response: unknown, model: string) => Promise<void>;

const PERIOD_DAYS = 30;

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    @InjectRepository(AiUsageEvent)
    private readonly usageRepository: Repository<AiUsageEvent>,
  ) {}

  reporter(userId: number, source: AiCredentialSource): OpenRouterUsageReporter {
    return (response, model) => this.recordResponse(userId, source, model, response);
  }

  async recordResponse(
    userId: number,
    credentialSource: AiCredentialSource,
    fallbackModel: string,
    response: unknown,
  ): Promise<void> {
    const record = this.parseUsage(response);
    if (!record) return;

    const responseModel = this.readRecord(response)?.model;
    const model =
      typeof responseModel === 'string' && responseModel.trim()
        ? responseModel.slice(0, 200)
        : fallbackModel.slice(0, 200);

    try {
      await this.usageRepository.save({
        userId,
        credentialSource,
        model,
        ...record,
        cost: String(record.cost),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Could not persist AI usage: ${message}`);
    }
  }

  async getPersonalUsage(userId: number): Promise<ThoughtyAiUsage> {
    const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const row = await this.usageRepository
      .createQueryBuilder('usage')
      .select('COALESCE(SUM(usage.prompt_tokens), 0)', 'promptTokens')
      .addSelect('COALESCE(SUM(usage.completion_tokens), 0)', 'completionTokens')
      .addSelect('COALESCE(SUM(usage.reasoning_tokens), 0)', 'reasoningTokens')
      .addSelect('COALESCE(SUM(usage.total_tokens), 0)', 'totalTokens')
      .addSelect('COALESCE(SUM(usage.cost), 0)', 'cost')
      .addSelect('COUNT(*)', 'requests')
      .where('usage.user_id = :userId', { userId })
      .andWhere('usage.credential_source = :source', { source: 'personal' })
      .andWhere('usage.created_at >= :since', { since })
      .getRawOne<UsageAggregateRow>();

    return {
      promptTokens: this.readAggregate(row?.promptTokens),
      completionTokens: this.readAggregate(row?.completionTokens),
      reasoningTokens: this.readAggregate(row?.reasoningTokens),
      totalTokens: this.readAggregate(row?.totalTokens),
      cost: this.readAggregate(row?.cost),
      requests: this.readAggregate(row?.requests),
      periodDays: PERIOD_DAYS,
    };
  }

  private parseUsage(response: unknown): Omit<ThoughtyAiUsage, 'requests' | 'periodDays'> | null {
    const usage = this.readRecord(
      this.readRecord(response)?.usage,
    ) as OpenRouterUsagePayload | null;
    if (!usage) return null;

    const promptTokens = this.readCount(usage.prompt_tokens ?? usage.input_tokens);
    const completionTokens = this.readCount(usage.completion_tokens ?? usage.output_tokens);
    const reasoningTokens = this.readCount(usage.completion_tokens_details?.reasoning_tokens);
    const totalTokens = this.readCount(usage.total_tokens) || promptTokens + completionTokens;
    const cost = this.readCost(usage.cost);

    return { promptTokens, completionTokens, reasoningTokens, totalTokens, cost };
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private readCount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? Math.floor(value)
      : 0;
  }

  private readCost(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
  }

  private readAggregate(value: string | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
}
