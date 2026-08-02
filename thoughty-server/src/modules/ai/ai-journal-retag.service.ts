import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { ConfigService } from '@/modules/config';
import { resolveAiModel } from './ai-model.util';
import { AiUsageService } from './ai-usage.service';
import { resolveOpenRouterCredential } from './openrouter-credential.util';
import { normalizeJournalTheme, requestJournalRetagPlan } from './journal-retagging';
import type {
  ApplyJournalRetagDto,
  ApplyJournalRetagResponseDto,
  JournalRetagPlanResponseDto,
} from './dto/journal-retag.dto';

const MAX_ANALYZED_ENTRIES = 300;

@Injectable()
export class AiJournalRetagService {
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly usageService: AiUsageService,
  ) {}

  async createPlan(userId: number): Promise<JournalRetagPlanResponseDto> {
    const [foundEntries, totalEntries] = await this.entryRepository.findAndCount({
      where: { userId },
      select: { id: true, date: true, index: true, content: true, tags: true },
      order: { date: 'DESC', index: 'ASC' },
      take: MAX_ANALYZED_ENTRIES,
    });
    const entries = foundEntries.filter((entry) => entry.content.trim().length > 0);
    const baseResponse = {
      analyzedEntries: entries.length,
      totalEntries,
      truncated: totalEntries > foundEntries.length,
    };
    if (entries.length === 0) {
      return { ...baseResponse, themes: [], entries: [] };
    }

    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }
    const model = await resolveAiModel(
      this.configService,
      userId,
      this.defaultModel,
      'openRouterTagModel',
    );
    const plan = await requestJournalRetagPlan({
      apiKey: credential.apiKey,
      model,
      entries,
      onUsage: this.usageService.reporter(userId, credential.source),
    });
    if (plan.themes.length === 0 || plan.assignments.length === 0) {
      throw new BadGatewayException('OpenRouter returned an invalid journal retag plan');
    }

    const assignments = new Map(
      plan.assignments.map((assignment) => [assignment.entryId, assignment.tags]),
    );
    return {
      ...baseResponse,
      themes: plan.themes,
      entries: entries.map((entry) => ({
        id: entry.id,
        date: entry.date,
        index: entry.index,
        currentTags: entry.tags,
        suggestedTags: assignments.get(entry.id) ?? [],
      })),
    };
  }

  async applyPlan(
    userId: number,
    dto: ApplyJournalRetagDto,
  ): Promise<ApplyJournalRetagResponseDto> {
    const uniqueAssignments = new Map(
      dto.assignments.map((assignment) => [assignment.entryId, assignment.tags]),
    );
    if (uniqueAssignments.size === 0) {
      throw new BadRequestException('At least one retag assignment is required');
    }

    const entries = await this.entryRepository.find({
      where: { userId, id: In([...uniqueAssignments.keys()]) },
    });
    if (entries.length !== uniqueAssignments.size) {
      throw new BadRequestException('One or more entries are unavailable');
    }

    for (const entry of entries) {
      const suggested = [
        ...new Set(
          (uniqueAssignments.get(entry.id) ?? []).map(normalizeJournalTheme).filter(Boolean),
        ),
      ];
      if (dto.mode === 'replace') {
        entry.tags = suggested;
        continue;
      }
      const existingKeys = new Set(entry.tags.map(normalizeJournalTheme));
      entry.tags = [...entry.tags, ...suggested.filter((tag) => !existingKeys.has(tag))].slice(
        0,
        20,
      );
    }
    await this.entryRepository.save(entries);
    return { success: true, affectedEntries: entries.length };
  }
}
