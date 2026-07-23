import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import {
  AiPersonalityService,
  type PersonalityAssessment,
  type WritingProfile,
  type WritingProfileItem,
} from '@/modules/ai';

export interface PersonalityAnalysisOptions {
  diaryId?: number;
  fromDate?: string;
  toDate?: string;
}

export interface PersonalityAnalysisResult extends PersonalityAssessment {
  analyzedEntries: number;
  analyzedWords: number;
  fromDate: string;
  toDate: string;
}

const PAGE_SIZE = 250;
const MAX_CONTENT_CHARS_PER_ENTRY = 20_000;
const MAX_TRACKED_WORDS = 5_000;
const MAX_TRACKED_SUBJECTS = 1_000;
const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'’-]{2,}/gu;
const STOP_WORDS = new Set([
  'and',
  'are',
  'but',
  'for',
  'from',
  'had',
  'has',
  'have',
  'not',
  'that',
  'the',
  'this',
  'was',
  'were',
  'with',
  'you',
  'your',
  'dans',
  'des',
  'elle',
  'est',
  'les',
  'mais',
  'nous',
  'pas',
  'pour',
  'que',
  'qui',
  'sur',
  'une',
  'vous',
]);

interface ProfileAccumulator {
  analyzedEntries: number;
  analyzedWords: number;
  truncatedEntries: number;
  fromDate: string;
  toDate: string;
  wordCounts: Map<string, number>;
  subjectCounts: Map<string, number>;
}

function incrementBounded(counts: Map<string, number>, label: string, maximumLabels: number): void {
  const current = counts.get(label);
  if (current !== undefined) {
    counts.set(label, current + 1);
  } else if (counts.size < maximumLabels) {
    counts.set(label, 1);
  }
}

function normalizeSubject(value: string): string {
  return value
    .trim()
    .replaceAll(/[\u0000-\u001F\u007F]/g, '')
    .slice(0, 64);
}

function addEntryToProfile(accumulator: ProfileAccumulator, entry: Entry): void {
  accumulator.analyzedEntries += 1;
  accumulator.fromDate =
    !accumulator.fromDate || entry.date < accumulator.fromDate ? entry.date : accumulator.fromDate;
  accumulator.toDate = entry.date > accumulator.toDate ? entry.date : accumulator.toDate;

  const content = entry.content ?? '';
  if (content.length > MAX_CONTENT_CHARS_PER_ENTRY) {
    accumulator.truncatedEntries += 1;
  }

  const analyzedContent = content.slice(0, MAX_CONTENT_CHARS_PER_ENTRY).toLocaleLowerCase();
  for (const match of analyzedContent.matchAll(TOKEN_PATTERN)) {
    const word = match[0].replaceAll(/^['’-]+|['’-]+$/g, '');
    accumulator.analyzedWords += 1;
    if (!STOP_WORDS.has(word)) {
      incrementBounded(accumulator.wordCounts, word, MAX_TRACKED_WORDS);
    }
  }

  for (const tag of entry.tags ?? []) {
    const subject = normalizeSubject(tag);
    if (subject) {
      incrementBounded(accumulator.subjectCounts, subject, MAX_TRACKED_SUBJECTS);
    }
  }
}

function getTopItems(counts: Map<string, number>, limit: number): WritingProfileItem[] {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function createWritingProfile(accumulator: ProfileAccumulator): WritingProfile {
  return {
    analyzedEntries: accumulator.analyzedEntries,
    analyzedWords: accumulator.analyzedWords,
    averageWordsPerEntry:
      accumulator.analyzedEntries > 0
        ? Math.round(accumulator.analyzedWords / accumulator.analyzedEntries)
        : 0,
    truncatedEntries: accumulator.truncatedEntries,
    fromDate: accumulator.fromDate,
    toDate: accumulator.toDate,
    topWords: getTopItems(accumulator.wordCounts, 30),
    topSubjects: getTopItems(accumulator.subjectCounts, 20),
  };
}

@Injectable()
export class StatsPersonalityAnalysisService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
    private readonly aiPersonalityService: AiPersonalityService,
  ) {}

  async analyze(
    userId: number,
    options: PersonalityAnalysisOptions,
  ): Promise<PersonalityAnalysisResult | null> {
    if (options.fromDate && options.toDate && options.fromDate > options.toDate) {
      throw new BadRequestException('The start date must be before or equal to the end date');
    }

    const accumulator: ProfileAccumulator = {
      analyzedEntries: 0,
      analyzedWords: 0,
      truncatedEntries: 0,
      fromDate: '',
      toDate: '',
      wordCounts: new Map(),
      subjectCounts: new Map(),
    };
    let lastEntryId = 0;

    while (true) {
      const query = this.entryRepository
        .createQueryBuilder('e')
        .select(['e.id', 'e.content', 'e.tags', 'e.date'])
        .where('e.user_id = :userId', { userId })
        .andWhere('e.id > :lastEntryId', { lastEntryId })
        .orderBy('e.id', 'ASC')
        .take(PAGE_SIZE);

      if (options.diaryId) {
        query.andWhere('e.diary_id = :diaryId', { diaryId: options.diaryId });
      }
      if (options.fromDate) {
        query.andWhere('e.date >= :fromDate', { fromDate: options.fromDate });
      }
      if (options.toDate) {
        query.andWhere('e.date <= :toDate', { toDate: options.toDate });
      }

      const entries = await query.getMany();
      for (const entry of entries) {
        addEntryToProfile(accumulator, entry);
      }

      if (entries.length < PAGE_SIZE) {
        break;
      }
      lastEntryId = entries.at(-1)?.id ?? lastEntryId;
    }

    const profile = createWritingProfile(accumulator);
    if (profile.analyzedEntries === 0 || profile.analyzedWords === 0) {
      return null;
    }

    const assessment = await this.aiPersonalityService.analyze(userId, profile);
    return assessment
      ? {
          ...assessment,
          analyzedEntries: profile.analyzedEntries,
          analyzedWords: profile.analyzedWords,
          fromDate: profile.fromDate,
          toDate: profile.toDate,
        }
      : null;
  }
}
