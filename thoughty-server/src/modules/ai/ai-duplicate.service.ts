import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { ConfigService } from '@/modules/config';
import { resolveAiModel } from './ai-model.util';
import { requestDuplicateGroups } from './duplicate-analysis';
import { AiUsageService } from './ai-usage.service';
import { resolveOpenRouterCredential } from './openrouter-credential.util';
import {
  DuplicateEntryScanResponseDto,
  FindDuplicateEntriesDto,
} from './dto/duplicate-entries.dto';

const MAX_ANALYZED_ENTRIES = 40;
const MAX_PREVIEW_LENGTH = 400;

@Injectable()
export class AiDuplicateService {
  private readonly defaultModel = process.env.OPENROUTER_TAG_MODEL || 'openai/gpt-4o-mini';
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    @Optional() private readonly usageService?: AiUsageService,
  ) {}

  async findDuplicates(
    userId: number,
    dto: FindDuplicateEntriesDto,
  ): Promise<DuplicateEntryScanResponseDto> {
    const [foundEntries, totalEntries] = await this.entryRepository.findAndCount({
      where: dto.diaryId == null ? { userId } : { userId, diaryId: dto.diaryId },
      select: { id: true, date: true, index: true, diaryId: true, content: true, tags: true },
      order: { date: 'DESC', index: 'DESC' },
      take: MAX_ANALYZED_ENTRIES,
    });
    const entries = foundEntries.filter((entry) => entry.content.trim().length > 0);
    const baseResponse = {
      analyzedEntries: entries.length,
      totalEntries,
      truncated: totalEntries > foundEntries.length,
    };

    if (entries.length < 2) {
      return { ...baseResponse, groups: [] };
    }
    const credential = await resolveOpenRouterCredential(this.configService, userId);
    if (!credential) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const model = await resolveAiModel(
      this.configService,
      userId,
      this.defaultModel,
      'openRouterToneModel',
    );
    const groups = await requestDuplicateGroups({
      apiKey: credential.apiKey,
      model,
      entries,
      onUsage: this.usageService?.reporter(userId, credential.source),
    });
    const entriesById = new Map(entries.map((entry) => [entry.id, entry]));

    return {
      ...baseResponse,
      groups: groups.map((group) => ({
        confidence: group.confidence,
        reason: group.reason,
        entries: group.entryIds.flatMap((entryId) => {
          const entry = entriesById.get(entryId);
          return entry
            ? [
                {
                  id: entry.id,
                  date: entry.date,
                  index: entry.index,
                  diaryId: entry.diaryId,
                  content: entry.content.slice(0, MAX_PREVIEW_LENGTH),
                  tags: entry.tags,
                },
              ]
            : [];
        }),
      })),
    };
  }
}
