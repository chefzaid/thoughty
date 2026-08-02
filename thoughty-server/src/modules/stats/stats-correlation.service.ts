import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import type { EntryCorrelationDto, StatsCorrelationsDto, TagCorrelationDto } from './dto';

const MAX_CONNECTIONS = 12;
const RECENT_CANDIDATES_PER_TAG = 4;

interface CorrelationEntry {
  id: number;
  date: string;
  index: number;
  tags: string[];
}

interface EntryCandidate {
  entry: CorrelationEntry;
  sharedTags: Set<string>;
}

interface TagPairAggregate {
  firstTag: string;
  secondTag: string;
  sharedEntries: number;
}

@Injectable()
export class StatsCorrelationService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async analyze(userId: number, diaryId?: number): Promise<StatsCorrelationsDto> {
    const query = this.entryRepository
      .createQueryBuilder('entry')
      .select(['entry.id', 'entry.date', 'entry.index', 'entry.tags'])
      .where('entry.user_id = :userId', { userId })
      .orderBy('entry.date', 'ASC')
      .addOrderBy('entry.index', 'ASC')
      .addOrderBy('entry.id', 'ASC');

    if (diaryId) query.andWhere('entry.diary_id = :diaryId', { diaryId });

    const entries = await query.getMany();
    return this.buildCorrelations(entries);
  }

  private buildCorrelations(entries: CorrelationEntry[]): StatsCorrelationsDto {
    const normalizedEntries = entries.map((entry) => ({
      ...entry,
      tags: [...new Set(entry.tags.map((tag) => tag.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    }));

    const tagCounts = new Map<string, number>();
    const tagPairs = new Map<string, TagPairAggregate>();
    for (const entry of normalizedEntries) {
      this.countTagPairs(entry.tags, tagCounts, tagPairs);
    }

    return {
      analyzedEntries: normalizedEntries.length,
      entryConnections: this.findEntryConnections(normalizedEntries),
      tagConnections: this.rankTagConnections(tagCounts, tagPairs),
    };
  }

  private countTagPairs(
    tags: string[],
    tagCounts: Map<string, number>,
    tagPairs: Map<string, TagPairAggregate>,
  ): void {
    for (const tag of tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);

    for (let firstIndex = 0; firstIndex < tags.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < tags.length; secondIndex += 1) {
        const firstTag = tags[firstIndex];
        const secondTag = tags[secondIndex];
        const key = `${firstTag}\u0000${secondTag}`;
        const pair = tagPairs.get(key) ?? { firstTag, secondTag, sharedEntries: 0 };
        pair.sharedEntries += 1;
        tagPairs.set(key, pair);
      }
    }
  }

  private findEntryConnections(entries: CorrelationEntry[]): EntryCorrelationDto[] {
    const recentByTag = new Map<string, CorrelationEntry[]>();
    const connections: EntryCorrelationDto[] = [];

    for (const entry of entries) {
      const candidates = new Map<number, EntryCandidate>();
      for (const tag of entry.tags) {
        for (const previous of recentByTag.get(tag) ?? []) {
          const candidate = candidates.get(previous.id) ?? {
            entry: previous,
            sharedTags: new Set<string>(),
          };
          candidate.sharedTags.add(tag);
          candidates.set(previous.id, candidate);
        }
      }

      const strongest = [...candidates.values()].sort(
        (left, right) =>
          right.sharedTags.size - left.sharedTags.size ||
          right.entry.date.localeCompare(left.entry.date) ||
          right.entry.id - left.entry.id,
      )[0];

      if (strongest) connections.push(this.toEntryConnection(strongest.entry, entry, strongest));

      for (const tag of entry.tags) {
        const recent = recentByTag.get(tag) ?? [];
        recent.push(entry);
        recentByTag.set(tag, recent.slice(-RECENT_CANDIDATES_PER_TAG));
      }
    }

    return connections
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.sharedTags.length - left.sharedTags.length ||
          right.sourceDate.localeCompare(left.sourceDate) ||
          right.sourceEntryId - left.sourceEntryId,
      )
      .slice(0, MAX_CONNECTIONS);
  }

  private toEntryConnection(
    target: CorrelationEntry,
    source: CorrelationEntry,
    candidate: EntryCandidate,
  ): EntryCorrelationDto {
    const score = this.percentage(
      candidate.sharedTags.size / Math.sqrt(source.tags.length * target.tags.length),
    );
    return {
      sourceEntryId: source.id,
      sourceDate: source.date,
      sourceIndex: source.index,
      targetEntryId: target.id,
      targetDate: target.date,
      targetIndex: target.index,
      sharedTags: [...candidate.sharedTags].sort((a, b) => a.localeCompare(b)),
      score,
    };
  }

  private rankTagConnections(
    tagCounts: Map<string, number>,
    tagPairs: Map<string, TagPairAggregate>,
  ): TagCorrelationDto[] {
    return [...tagPairs.values()]
      .map((pair) => ({
        ...pair,
        strength: this.percentage(
          pair.sharedEntries /
            Math.sqrt((tagCounts.get(pair.firstTag) ?? 1) * (tagCounts.get(pair.secondTag) ?? 1)),
        ),
      }))
      .sort(
        (left, right) =>
          right.strength - left.strength ||
          right.sharedEntries - left.sharedEntries ||
          left.firstTag.localeCompare(right.firstTag) ||
          left.secondTag.localeCompare(right.secondTag),
      )
      .slice(0, MAX_CONNECTIONS);
  }

  private percentage(value: number): number {
    return Math.min(100, Math.max(0, Math.round(value * 100)));
  }
}
