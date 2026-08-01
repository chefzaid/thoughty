import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { SemanticSearchDto, SemanticSearchResponseDto } from './dto/semantic-search.dto';
import { rankSemanticMatches, requestEmbeddings } from './semantic-search';

const MAX_ANALYZED_ENTRIES = 100;
const MAX_ENTRY_CONTENT_LENGTH = 1200;
const MAX_MATCHES = 20;

@Injectable()
export class AiSemanticSearchService {
  private readonly apiKey = process.env.OPENROUTER_API_KEY || '';
  private readonly model = process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';

  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async search(userId: number, dto: SemanticSearchDto): Promise<SemanticSearchResponseDto> {
    const [foundEntries, totalEntries] = await this.entryRepository.findAndCount({
      where: dto.diaryId == null ? { userId } : { userId, diaryId: dto.diaryId },
      select: { id: true, content: true, tags: true },
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
      return { ...baseResponse, matches: [] };
    }
    if (!this.apiKey) {
      throw new BadRequestException('OpenRouter API key is not configured');
    }

    const input = [
      dto.query.trim(),
      ...entries.map((entry) => [
        entry.tags.slice(0, 10).join(', '),
        entry.content.slice(0, MAX_ENTRY_CONTENT_LENGTH),
      ].filter(Boolean).join('\n')),
    ];
    const [queryVector, ...entryVectors] = await requestEmbeddings({
      apiKey: this.apiKey,
      model: this.model,
      input,
    });

    return {
      ...baseResponse,
      matches: rankSemanticMatches(
        queryVector!,
        entries.map((entry, index) => ({ id: entry.id, vector: entryVectors[index]! })),
        MAX_MATCHES,
      ),
    };
  }
}
