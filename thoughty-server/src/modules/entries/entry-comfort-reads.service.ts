import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Entry } from '@/database/entities';
import { plainExcerpt } from '@/common/utils/plain-excerpt.util';
import type { ComfortReadsResponseDto, GetComfortReadsQueryDto } from './dto';

/** At most this many entries are offered at once. */
export const COMFORT_READS_LIMIT = 3;
/**
 * Tags that mark an entry written with gratitude, compared without case: the word itself (the same in
 * English and French), the English adjective, and the French noun.
 */
export const GRATITUDE_TAGS: readonly string[] = ['gratitude', 'grateful', 'reconnaissance'];
/** Characters of the text read for an excerpt, and the length of the excerpt itself. */
const EXCERPT_SOURCE_LENGTH = 400;
const EXCERPT_LENGTH = 140;

interface ComfortRow {
  id: number | string;
  date: string;
  index: number | string;
  title: string | null;
  content_start: string | null;
}

/**
 * Comfort reads: after the writer records a very low mood, the web offers to reread a few entries they
 * kept as favorites or tagged with gratitude. PostgreSQL picks up to three of them with `ORDER BY random()
 * LIMIT 3`, so the picks are distinct, every candidate is equally likely, and only those rows (with the
 * start of their text) leave the database. Sealed time capsules and the entry just written are never
 * offered; entries in the recycle bin are left out by the entity's soft delete.
 *
 * The journal filters cannot express this in one request: they combine with AND (favorites *and* a tag),
 * and the random entry endpoint gives one ID per call without its text.
 */
@Injectable()
export class EntryComfortReadsService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async pick(userId: number, { excludeId }: GetComfortReadsQueryDto): Promise<ComfortReadsResponseDto> {
    const qb = this.entryRepository
      .createQueryBuilder('e')
      .select('e.id', 'id')
      .addSelect("TO_CHAR(e.date, 'YYYY-MM-DD')", 'date')
      .addSelect('e.index', 'index')
      .addSelect('e.title', 'title')
      .addSelect('LEFT(e.content, :excerptSource)', 'content_start')
      .setParameter('excerptSource', EXCERPT_SOURCE_LENGTH)
      .where('e.user_id = :userId', { userId })
      .andWhere('e.sealed_until IS NULL')
      .andWhere(
        '(e.is_favorite = true OR EXISTS (SELECT 1 FROM unnest(e.tags) AS tag WHERE lower(tag) IN (:...gratitudeTags)))',
        { gratitudeTags: GRATITUDE_TAGS },
      );
    if (excludeId) {
      qb.andWhere('e.id <> :excludeId', { excludeId });
    }

    const rows = await qb.orderBy('RANDOM()').limit(COMFORT_READS_LIMIT).getRawMany<ComfortRow>();
    return {
      entries: rows.map((row) => ({
        id: Number(row.id),
        date: row.date,
        index: Number(row.index),
        title: row.title ?? null,
        excerpt: plainExcerpt(row.content_start ?? '', EXCERPT_LENGTH),
      })),
    };
  }
}
