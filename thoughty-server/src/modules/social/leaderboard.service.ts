import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import { stripMarkdown } from '@/common/utils';
import { Entry } from '@/database/entities';
import type {
  LeaderboardAuthorDto,
  LeaderboardEntryRankDto,
  LeaderboardPeriod,
  LeaderboardResponseDto,
} from './dto';
import { applyPublicFeedVisibility, joinEngagementByOthers } from './public-feed-visibility';

export const LEADERBOARD_SIZE = 10;
export const EXCERPT_LENGTH = 280;

const PERIOD_DAYS: Record<Exclude<LeaderboardPeriod, 'all'>, number> = {
  week: 7,
  month: 30,
  year: 365,
};

interface AuthorRow {
  authorId: number | string;
  username: string;
  avatarUrl: string | null;
}

interface EntryRankRow extends AuthorRow {
  id: number | string;
  date: string;
  content: string;
  format: 'plain' | 'markdown';
  count: number | string;
}

const toAuthor = (row: AuthorRow): LeaderboardAuthorDto => ({
  id: Number(row.authorId),
  username: row.username,
  avatarUrl: row.avatarUrl,
});

/** A single-paragraph preview; the leaderboard renders it as plain text. */
const toExcerpt = (text: string): string =>
  text.replaceAll(/\s+/g, ' ').trim().slice(0, EXCERPT_LENGTH);

const toEntryRank = (row: EntryRankRow): LeaderboardEntryRankDto => ({
  id: Number(row.id),
  date: row.date,
  excerpt: toExcerpt(row.format === 'markdown' ? stripMarkdown(row.content) : row.content),
  author: toAuthor(row),
  count: Number(row.count),
});

/**
 * Ranks only what the public feed can show, so private journaling activity and moderated,
 * archived, or deleted-account content never influence or appear in the rankings.
 */
@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(Entry)
    private readonly entryRepository: Repository<Entry>,
  ) {}

  async getLeaderboard(
    period: LeaderboardPeriod = 'month',
    now = new Date(),
  ): Promise<LeaderboardResponseDto> {
    const since =
      period === 'all' ? null : new Date(now.getTime() - PERIOD_DAYS[period] * 86_400_000);
    const [authors, liked, commented] = await Promise.all([
      this.mostActiveAuthors(since),
      this.mostEngagedEntries(since, 'entry_likes'),
      this.mostEngagedEntries(since, 'entry_comments'),
    ]);

    return {
      period,
      mostActiveAuthors: authors.map((row) => ({
        author: toAuthor(row),
        publicEntries: Number(row.count),
      })),
      mostLikedEntries: liked.map(toEntryRank),
      mostCommentedEntries: commented.map(toEntryRank),
    };
  }

  private publicEntries(since: Date | null): SelectQueryBuilder<Entry> {
    const qb = applyPublicFeedVisibility(
      this.entryRepository.createQueryBuilder('e').innerJoin('e.user', 'u'),
    );
    if (since) qb.andWhere('e.created_at >= :since', { since });
    return qb;
  }

  private mostActiveAuthors(since: Date | null): Promise<Array<AuthorRow & { count: string }>> {
    return this.publicEntries(since)
      .select('u.id', 'authorId')
      .addSelect('u.username', 'username')
      .addSelect('u.avatar_url', 'avatarUrl')
      .addSelect('COUNT(e.id)', 'count')
      .groupBy('u.id')
      .addGroupBy('u.username')
      .addGroupBy('u.avatar_url')
      .orderBy('COUNT(e.id)', 'DESC')
      .addOrderBy('u.username', 'ASC')
      .limit(LEADERBOARD_SIZE)
      .getRawMany();
  }

  /** Entries published in the period, ranked by likes or by comments from other active users. */
  private mostEngagedEntries(
    since: Date | null,
    table: 'entry_likes' | 'entry_comments',
  ): Promise<EntryRankRow[]> {
    return (
      joinEngagementByOthers(this.publicEntries(since), table)
        .select('e.id', 'id')
        // Raw DATE values would be parsed into time-zone-dependent Date objects.
        .addSelect("TO_CHAR(e.date, 'YYYY-MM-DD')", 'date')
        .addSelect('e.content', 'content')
        .addSelect('e.format', 'format')
        .addSelect('u.id', 'authorId')
        .addSelect('u.username', 'username')
        .addSelect('u.avatar_url', 'avatarUrl')
        .addSelect('COUNT(*)', 'count')
        .groupBy('e.id')
        .addGroupBy('u.id')
        .orderBy('COUNT(*)', 'DESC')
        .addOrderBy('e.created_at', 'DESC')
        .limit(LEADERBOARD_SIZE)
        .getRawMany()
    );
  }
}
